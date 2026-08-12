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

// 50円は明日の釣り銭として必ず残し、売上として抜かない
const SALES_PRIORITY = [
    10,
    5,
    1,
    10000,
    1000,
    500,
    100,
    5000
];

document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll(".money-input");

    inputs.forEach((input) => {
        input.addEventListener("input", () => {
            updateLiveAmounts();
        });
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


function formatMoneyCount(money, count) {
    return `${money.toLocaleString("ja-JP")}円 × ${count}枚`;
}


function updateLiveAmounts() {
    const current = getCurrentMoney();
    const total = getTotal(current);

    MONEY_LIST.forEach((money) => {
        const amountElement = document.getElementById(`amount${money}`);

        if (amountElement) {
            amountElement.textContent = formatYen(
                money * current[money]
            );
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


function createMoneyRows(moneyData, options = {}) {
    const {
        showAmount = false,
        protectedMoney = false
    } = options;

    const rows = [];

    MONEY_LIST.forEach((money) => {
        const count = moneyData[money] || 0;

        if (count <= 0) {
            return;
        }

        const amount = money * count;

        if (showAmount) {
            rows.push(`
                <div class="money-row">
                    <span>${money.toLocaleString("ja-JP")}円</span>
                    <strong>${count}枚</strong>
                    <span>${formatYen(amount)}</span>
                </div>
            `);
            return;
        }

        if (protectedMoney && money === 50) {
            rows.push(`
                <div class="money-row protected-money-row">
                    <span>
                        ${money.toLocaleString("ja-JP")}円
                        <span class="protected-badge">売上対象外</span>
                    </span>
                    <strong>${count}枚</strong>
                    <span>${formatYen(amount)}</span>
                </div>
            `);
            return;
        }

        rows.push(`
            <div class="money-row">
                <span>${money.toLocaleString("ja-JP")}円</span>
                <strong>${count}枚</strong>
                <span>${formatYen(amount)}</span>
            </div>
        `);
    });

    return rows.join("");
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


function calculateSales(current, salesAmount) {
    const remaining = {
        ...current
    };

    const salesResult = {};

    MONEY_LIST.forEach((money) => {
        salesResult[money] = 0;
    });

    let remainingSales = salesAmount;

    for (const money of SALES_PRIORITY) {
        while (
            remaining[money] > 0 &&
            remainingSales >= money
        ) {
            remaining[money]--;
            salesResult[money]++;
            remainingSales -= money;
        }
    }

    return {
        salesResult,
        remaining,
        remainingSales
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

    const now = new Date();
    const timeText = getTimeText(now);

    const salesAmount = total - TARGET_TOTAL;

    const {
        salesResult,
        remaining,
        remainingSales
    } = calculateSales(current, salesAmount);

    /*
     * 通常はここで0円になる。
     * 0円にならない場合は、現在の金種だけでは
     * 売上金額を正確に抜けない状態。
     */
    if (remainingSales !== 0) {
        showError(
            `現在の金種では売上${formatYen(salesAmount)}を正確に抜けません。金種を確認してください。`
        );
        return;
    }

    const actualSales = getTotal(salesResult);

    const {
        give,
        receive
    } = calculateDifference(remaining);

    const giveTotal = getTotal(give);
    const receiveTotal = getTotal(receive);

    const registerList = createSimpleMoneyRows(current);

    const salesList = createSimpleMoneyRows(salesResult);

    const giveList = createSimpleMoneyRows(give);

    const receiveList = createSimpleMoneyRows(receive);

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
        formatYen(actualSales);

    document.getElementById("salesDifference").textContent =
        formatYen(salesAmount - actualSales);

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