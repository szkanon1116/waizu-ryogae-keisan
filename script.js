const MONEY_LIST = [
    10000,
    5000,
    1000,
    500,
    100,
    50,
    10,
    5,
    1
];

const TARGET = {
    10000: 0,
    5000: 6,
    1000: 10,
    500: 20,
    100: 198,
    50: 4,
    10: 0,
    5: 0,
    1: 0
};

const TARGET_TOTAL = 70000;
const PROTECTED_50 = 4;

document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll(".money-input");

    inputs.forEach((input) => {
        input.addEventListener("input", updateLiveAmounts);
    });

    document
        .getElementById("calculateButton")
        .addEventListener("click", calculate);

    updateLiveAmounts();
});


function getCurrentMoney() {
    const current = {};

    MONEY_LIST.forEach((money) => {
        const input = document.getElementById(`d${money}`);
        const value = Number(input.value);

        current[money] =
            Number.isFinite(value) && value >= 0
                ? Math.floor(value)
                : 0;
    });

    return current;
}


function getTotal(moneyData) {
    return MONEY_LIST.reduce((total, money) => {
        return total + money * moneyData[money];
    }, 0);
}


function formatYen(value) {
    return `${value.toLocaleString("ja-JP")}円`;
}


function updateLiveAmounts() {
    const current = getCurrentMoney();
    const total = getTotal(current);

    MONEY_LIST.forEach((money) => {
        const amountElement = document.getElementById(`amount${money}`);

        if (amountElement) {
            amountElement.textContent =
                formatYen(money * current[money]);
        }
    });

    document.getElementById("liveTotal").textContent =
        formatYen(total);
}


function getTimeText(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}


function createSimpleMoneyRows(moneyData) {
    const rows = [];

    MONEY_LIST.forEach((money) => {
        const count = moneyData[money] || 0;

        if (count <= 0) {
            return;
        }

        rows.push(`
            <div class="money-row">
                <span>${money.toLocaleString("ja-JP")}円</span>
                <strong>${count}枚</strong>
                <span>${formatYen(money * count)}</span>
            </div>
        `);
    });

    return rows.join("");
}


/*
 * 現在の金種から、売上額と完全一致する組み合わせを探す。
 * 50円は4枚を必ず残し、5枚目以降だけ売上に使用する。
 */
function calculateSales(current, salesAmount) {
    const available = {};

    MONEY_LIST.forEach((money) => {
        available[money] = current[money];

        if (money === 50) {
            available[money] =
                Math.max(0, current[money] - PROTECTED_50);
        }
    });

    const dp = new Int32Array(salesAmount + 1);
    const prevAmount = new Int32Array(salesAmount + 1);
    const prevMoney = new Int32Array(salesAmount + 1);
    const prevCount = new Int32Array(salesAmount + 1);

    dp.fill(-1);
    prevAmount.fill(-1);
    prevMoney.fill(-1);
    prevCount.fill(0);

    dp[0] = 0;

    for (const money of MONEY_LIST) {
        const maxCount = available[money];

        if (maxCount <= 0 || money > salesAmount) {
            continue;
        }

        let remainingCount = maxCount;
        let block = 1;

        while (remainingCount > 0) {
            const useCount = Math.min(block, remainingCount);
            const value = money * useCount;

            for (
                let amount = salesAmount;
                amount >= value;
                amount--
            ) {
                if (
                    dp[amount] === -1 &&
                    dp[amount - value] !== -1
                ) {
                    dp[amount] = 1;
                    prevAmount[amount] = amount - value;
                    prevMoney[amount] = money;
                    prevCount[amount] = useCount;
                }
            }

            remainingCount -= useCount;
            block *= 2;
        }
    }

    if (dp[salesAmount] === -1) {
        return null;
    }

    const salesResult = {};

    MONEY_LIST.forEach((money) => {
        salesResult[money] = 0;
    });

    let amount = salesAmount;

    while (amount > 0) {
        const money = prevMoney[amount];
        const count = prevCount[amount];

        if (money <= 0 || count <= 0) {
            return null;
        }

        salesResult[money] += count;
        amount = prevAmount[amount];
    }

    const remaining = {};

    MONEY_LIST.forEach((money) => {
        remaining[money] =
            current[money] - salesResult[money];
    });

    return {
        salesResult,
        remaining
    };
}


function calculateDifference(current) {
    const give = {};
    const receive = {};

    MONEY_LIST.forEach((money) => {
        const difference =
            current[money] - TARGET[money];

        if (difference > 0) {
            give[money] = difference;
        } else {
            give[money] = 0;
        }

        if (difference < 0) {
            receive[money] = Math.abs(difference);
        } else {
            receive[money] = 0;
        }
    });

    return {
        give,
        receive
    };
}


function showError(message) {
    const errorBox = document.getElementById("errorBox");
    const errorMessage = document.getElementById("errorMessage");

    errorMessage.textContent = message;
    errorBox.classList.remove("hidden");

    document
        .getElementById("result")
        .classList.add("hidden");

    errorBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


function hideError() {
    document
        .getElementById("errorBox")
        .classList.add("hidden");
}


function calculate() {
    hideError();

    const current = getCurrentMoney();
    const total = getTotal(current);

    if (total < TARGET_TOTAL) {
        showError(
            `レジ金が70,000円に足りません。現在は${formatYen(total)}です。`
        );
        return;
    }

    const salesAmount = total - TARGET_TOTAL;

    const result = calculateSales(
        current,
        salesAmount
    );

    if (!result) {
        showError(
            `現在の金種では売上${formatYen(salesAmount)}を正確に抜けません。金種を確認してください。`
        );
        return;
    }

    const {
        salesResult,
        remaining
    } = result;

    const remainingTotal = getTotal(remaining);

    if (remainingTotal !== TARGET_TOTAL) {
        showError(
            `売上を抜いた後のレジ金が70,000円になりませんでした。金種を確認してください。`
        );
        return;
    }

    const {
        give,
        receive
    } = calculateDifference(remaining);

    const giveTotal = getTotal(give);
    const receiveTotal = getTotal(receive);

    const salesList = createSimpleMoneyRows(salesResult);
    const registerList = createSimpleMoneyRows(current);
    const giveList = createSimpleMoneyRows(give);
    const receiveList = createSimpleMoneyRows(receive);

    const now = new Date();
    const timeText = getTimeText(now);

    document.getElementById("resultTotal").textContent =
        formatYen(total);

    document.getElementById("inputTime").textContent =
        `${timeText} 入力完了`;

    document.getElementById("registerList").innerHTML =
        registerList ||
        `<div class="empty-message">入力された金種はありません</div>`;

    document.getElementById("salesAmount").textContent =
        formatYen(salesAmount);

    document.getElementById("salesList").innerHTML =
        salesList ||
        `<div class="empty-message">売上として抜くお金はありません</div>`;

    document.getElementById("actualSales").textContent =
        formatYen(salesAmount);

    document.getElementById("salesDifference").textContent =
        formatYen(0);

    document.getElementById("giveList").innerHTML =
        giveList ||
        `<div class="empty-message">渡すお金はありません</div>`;

    document.getElementById("receiveList").innerHTML =
        receiveList ||
        `<div class="empty-message">もらうお金はありません</div>`;

    document.getElementById("giveTotal").textContent =
        formatYen(giveTotal);

    document.getElementById("receiveTotal").textContent =
        formatYen(receiveTotal);

    document.getElementById("completeTime").textContent =
        `${timeText} に処理しました`;

    document
        .getElementById("result")
        .classList.remove("hidden");

    document
        .getElementById("result")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}