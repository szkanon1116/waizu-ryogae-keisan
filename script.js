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


document.addEventListener("DOMContentLoaded", () => {
    const inputs =
        document.querySelectorAll(".money-input");

    inputs.forEach((input) => {
        input.addEventListener(
            "input",
            updateLiveAmounts
        );
    });

    document
        .getElementById("calculateButton")
        .addEventListener(
            "click",
            calculate
        );

    updateLiveAmounts();
});


function getCurrentMoney() {
    const current = {};

    MONEY_LIST.forEach((money) => {
        const input =
            document.getElementById(
                `d${money}`
            );

        const value =
            Number(input.value);

        current[money] =
            Number.isFinite(value) &&
            value >= 0
                ? Math.floor(value)
                : 0;
    });

    return current;
}


function getTotal(moneyData) {
    return MONEY_LIST.reduce(
        (total, money) => {
            return (
                total +
                money *
                (moneyData[money] || 0)
            );
        },
        0
    );
}


function formatYen(value) {
    return `${value.toLocaleString("ja-JP")}円`;
}


function updateLiveAmounts() {
    const current =
        getCurrentMoney();

    const total =
        getTotal(current);

    MONEY_LIST.forEach((money) => {
        const amountElement =
            document.getElementById(
                `amount${money}`
            );

        if (amountElement) {
            amountElement.textContent =
                formatYen(
                    money *
                    current[money]
                );
        }
    });

    document
        .getElementById("liveTotal")
        .textContent =
        formatYen(total);
}


function getTimeText(date) {
    const hours =
        String(
            date.getHours()
        ).padStart(2, "0");

    const minutes =
        String(
            date.getMinutes()
        ).padStart(2, "0");

    return `${hours}:${minutes}`;
}


function createSimpleMoneyRows(
    moneyData
) {
    const rows = [];

    MONEY_LIST.forEach((money) => {
        const count =
            moneyData[money] || 0;

        if (count <= 0) {
            return;
        }

        rows.push(`
            <div class="money-row">
                <span>
                    ${money.toLocaleString("ja-JP")}円
                </span>

                <strong>
                    ${count}枚
                </strong>

                <span>
                    ${formatYen(
                        money * count
                    )}
                </span>
            </div>
        `);
    });

    return rows.join("");
}


/*
 * 金種の組み合わせを比較する。
 *
 * 優先順位：
 *
 * 1. 不足している金種を使う金額を最小化
 * 2. 不足金種を使う枚数を最小化
 * 3. 使用枚数を最小化
 * 4. 大きい金種を優先
 *
 * つまり、
 *
 * 「余っている500円を使えるのに
 *  足りない100円を使う」
 *
 * という組み合わせを避ける。
 */
function isBetterState(a, b) {
    if (!b) {
        return true;
    }


    /*
     * 不足している金種を
     * いくら使ったか。
     *
     * これが最重要。
     */
    if (
        a.deficitValue !==
        b.deficitValue
    ) {
        return (
            a.deficitValue <
            b.deficitValue
        );
    }


    /*
     * 同じ金額の不足なら、
     * 枚数が少ない方。
     */
    if (
        a.deficitCount !==
        b.deficitCount
    ) {
        return (
            a.deficitCount <
            b.deficitCount
        );
    }


    /*
     * 次に全体の使用枚数。
     */
    if (
        a.coinCount !==
        b.coinCount
    ) {
        return (
            a.coinCount <
            b.coinCount
        );
    }


    /*
     * 同条件なら大きい金種を優先。
     */
    for (
        let i = 0;
        i < MONEY_LIST.length;
        i++
    ) {
        const money =
            MONEY_LIST[i];

        const aCount =
            a.counts[money] || 0;

        const bCount =
            b.counts[money] || 0;

        if (
            aCount !==
            bCount
        ) {
            return (
                aCount >
                bCount
            );
        }
    }

    return false;
}


/*
 * 売上金額を完全一致で作る。
 *
 * 金種の基本方針：
 *
 * ・5,000円は6枚残す
 * ・1,000円は10枚残す
 * ・500円は20枚残す
 * ・100円は198枚残す
 * ・50円は4枚残す
 *
 * ただし、
 * 基準枚数を下回っている金種は
 * 「不足金種」として扱う。
 *
 * 余っている金種を使える場合は
 * 不足金種をできるだけ使わない。
 */
function findSalesCombination(
    current,
    targetAmount
) {
    if (targetAmount < 0) {
        return null;
    }


    const dp = new Map();


    dp.set(0, {
        deficitValue: 0,

        deficitCount: 0,

        coinCount: 0,

        counts: {}
    });


    for (
        const money of MONEY_LIST
    ) {
        const currentCount =
            current[money] || 0;

        const targetCount =
            TARGET[money] || 0;


        /*
         * 基準を超えている枚数。
         *
         * ここは「余剰」なので
         * 売上として使っても
         * レジの必要枚数を崩さない。
         */
        const surplusCount =
            Math.max(
                0,
                currentCount -
                targetCount
            );


        let maxUse =
            currentCount;


        /*
         * 50円は特殊。
         *
         * 4枚は必ず残す。
         */
        if (
            money === 50
        ) {
            if (
                currentCount >= 4
            ) {
                maxUse =
                    currentCount - 4;
            } else {
                maxUse =
                    currentCount;
            }
        }


        /*
         * その他の金種。
         *
         * 基準枚数以上ある場合は
         * 余剰分だけを優先的に使用。
         *
         * 基準未満なら、
         * 必要に応じて使用可能。
         */
        if (
            money !== 50 &&
            currentCount > targetCount
        ) {
            maxUse =
                surplusCount;
        }


        const next =
            new Map();


        for (
            const [amount, state]
            of dp.entries()
        ) {

            for (
                let useCount = 0;
                useCount <= maxUse;
                useCount++
            ) {

                const newAmount =
                    amount +
                    money *
                    useCount;


                if (
                    newAmount >
                    targetAmount
                ) {
                    break;
                }


                /*
                 * 今回使う金種のうち、
                 * 「必要枚数を下回ってしまう分」
                 * を計算。
                 */
                let deficitValue =
                    state.deficitValue;

                let deficitCount =
                    state.deficitCount;


                const protectedCount =
                    Math.min(
                        targetCount,
                        currentCount
                    );


                const deficitUse =
                    Math.max(
                        0,
                        useCount -
                        Math.max(
                            0,
                            currentCount -
                            protectedCount
                        )
                    );


                /*
                 * 50円は4枚保護。
                 */
                let actualDeficitUse =
                    deficitUse;


                if (
                    money === 50
                ) {
                    const availableAboveFour =
                        Math.max(
                            0,
                            currentCount -
                            4
                        );


                    actualDeficitUse =
                        Math.max(
                            0,
                            useCount -
                            availableAboveFour
                        );
                }


                deficitValue +=
                    money *
                    actualDeficitUse;


                deficitCount +=
                    actualDeficitUse;


                const newCounts = {
                    ...state.counts,
                    [money]:
                        useCount
                };


                const newState = {
                    deficitValue,

                    deficitCount,

                    coinCount:
                        state.coinCount +
                        useCount,

                    counts:
                        newCounts
                };


                const existing =
                    next.get(
                        newAmount
                    );


                if (
                    !existing ||
                    isBetterState(
                        newState,
                        existing
                    )
                ) {
                    next.set(
                        newAmount,
                        newState
                    );
                }
            }
        }


        dp.clear();


        for (
            const [amount, state]
            of next.entries()
        ) {
            dp.set(
                amount,
                state
            );
        }
    }


    const result =
        dp.get(targetAmount);


    if (!result) {
        return null;
    }


    const salesResult = {};


    MONEY_LIST.forEach((money) => {
        salesResult[money] =
            result.counts[money] ||
            0;
    });


    /*
     * 入力枚数以上を
     * 使用していないか確認。
     */
    for (
        const money of MONEY_LIST
    ) {
        if (
            salesResult[money] >
            (current[money] || 0)
        ) {
            return null;
        }
    }


    /*
     * 50円は4枚以上あれば
     * 必ず4枚残す。
     */
    const minimum50 =
        current[50] >= 4
            ? 4
            : 0;


    if (
        current[50] -
        salesResult[50] <
        minimum50
    ) {
        return null;
    }


    const remaining = {};


    MONEY_LIST.forEach((money) => {
        remaining[money] =
            current[money] -
            salesResult[money];
    });


    return {
        salesResult,
        remaining
    };
}


function calculateSales(
    current,
    actualSalesAmount
) {
    const result =
        findSalesCombination(
            current,
            actualSalesAmount
        );


    if (!result) {
        return null;
    }


    return {
        ...result,

        actualSalesAmount,

        salesTakeAmount:
            actualSalesAmount
    };
}


function calculateDifference(
    current
) {
    const give = {};
    const receive = {};


    MONEY_LIST.forEach((money) => {
        give[money] = 0;
        receive[money] = 0;
    });


    MONEY_LIST.forEach((money) => {

        const difference =
            current[money] -
            TARGET[money];


        if (
            difference > 0
        ) {
            give[money] =
                difference;
        }


        if (
            difference < 0
        ) {
            receive[money] =
                Math.abs(
                    difference
                );
        }
    });


    return {
        give,
        receive
    };
}


function showError(message) {
    const errorBox =
        document.getElementById(
            "errorBox"
        );

    const errorMessage =
        document.getElementById(
            "errorMessage"
        );


    errorMessage.textContent =
        message;


    errorBox.classList.remove(
        "hidden"
    );


    document
        .getElementById("result")
        .classList
        .add("hidden");


    errorBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


function hideError() {
    document
        .getElementById("errorBox")
        .classList
        .add("hidden");
}


function calculate() {
    hideError();


    const current =
        getCurrentMoney();


    const total =
        getTotal(current);


    if (
        total <
        TARGET_TOTAL
    ) {
        showError(
            `レジ金が70,000円に足りません。現在は${formatYen(total)}です。`
        );

        return;
    }


    const actualSalesAmount =
        total -
        TARGET_TOTAL;


    const result =
        calculateSales(
            current,
            actualSalesAmount
        );


    /*
     * 売上は必ず完全一致。
     */
    if (!result) {
        showError(
            `現在の金種では売上${formatYen(actualSalesAmount)}を正確に抜けません。金種を確認してください。`
        );

        return;
    }


    const {
        salesResult,
        remaining,
        salesTakeAmount
    } = result;


    /*
     * 売上額との完全一致確認。
     */
    if (
        salesTakeAmount !==
        actualSalesAmount
    ) {
        showError(
            `売上金額と抜く金額が一致しません。計算を停止しました。`
        );

        return;
    }


    /*
     * 売上を抜いた後、
     * レジ金が必ず70,000円になることを確認。
     */
    const remainingTotal =
        getTotal(remaining);


    if (
        remainingTotal !==
        TARGET_TOTAL
    ) {
        showError(
            `売上を抜いた後のレジ金が70,000円になりませんでした。計算を停止しました。`
        );

        return;
    }


    /*
     * 50円4枚保護確認。
     */
    const minimum50 =
        current[50] >= 4
            ? 4
            : 0;


    if (
        remaining[50] <
        minimum50
    ) {
        showError(
            `50円玉の残枚数が不正です。計算を停止しました。`
        );

        return;
    }


    const {
        give,
        receive
    } =
        calculateDifference(
            remaining
        );


    const giveTotal =
        getTotal(give);


    const receiveTotal =
        getTotal(receive);


    /*
     * 両替金額も必ず一致。
     */
    if (
        giveTotal !==
        receiveTotal
    ) {
        showError(
            `両替計算の金額が一致しません。計算を停止しました。`
        );

        return;
    }


    const salesList =
        createSimpleMoneyRows(
            salesResult
        );


    const registerList =
        createSimpleMoneyRows(
            current
        );


    const giveList =
        createSimpleMoneyRows(
            give
        );


    const receiveList =
        createSimpleMoneyRows(
            receive
        );


    const now =
        new Date();


    const timeText =
        getTimeText(now);


    document
        .getElementById(
            "resultTotal"
        )
        .textContent =
        formatYen(total);


    document
        .getElementById(
            "inputTime"
        )
        .textContent =
        `${timeText} 入力完了`;


    document
        .getElementById(
            "registerList"
        )
        .innerHTML =
        registerList ||
        `<div class="empty-message">入力された金種はありません</div>`;


    document
        .getElementById(
            "salesAmount"
        )
        .textContent =
        formatYen(
            actualSalesAmount
        );


    document
        .getElementById(
            "salesList"
        )
        .innerHTML =
        salesList ||
        `<div class="empty-message">売上として抜くお金はありません</div>`;


    document
        .getElementById(
            "actualSales"
        )
        .textContent =
        formatYen(
            salesTakeAmount
        );


    /*
     * 売上との差額は必ず0円。
     */
    document
        .getElementById(
            "salesDifference"
        )
        .textContent =
        "0円";


    document
        .getElementById(
            "giveList"
        )
        .innerHTML =
        giveList ||
        `<div class="empty-message">渡すお金はありません</div>`;


    document
        .getElementById(
            "receiveList"
        )
        .innerHTML =
        receiveList ||
        `<div class="empty-message">もらうお金はありません</div>`;


    document
        .getElementById(
            "giveTotal"
        )
        .textContent =
        formatYen(
            giveTotal
        );


    document
        .getElementById(
            "receiveTotal"
        )
        .textContent =
        formatYen(
            receiveTotal
        );


    document
        .getElementById(
            "completeTime"
        )
        .textContent =
        `${timeText} に処理しました`;


    document
        .getElementById(
            "result"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "result"
        )
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}