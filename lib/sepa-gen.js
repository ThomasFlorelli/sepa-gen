

const moment = require('moment');
const _ = require('lodash');

/**
 * A payment object to setup, generates a JSON if all details are provided
 * correctly
 * Mandatory information:
 * - reference
 * - currency
 * - a valid debtor account
 * - at least 1 transaction
*/
const sepaPayment = function () {
  let that = {};
  let my = {
    transactionGroups: {},
  };

  /**
  * Private members
  */
  let getErrors;
  let generateErrorString;
  let isDebtorAccountValid;
  let getTransactionGroup;

  /**
  * Private SEPA generators
  */
  let getBaseSepaObject;
  let getTransactionGroupSepaObject;
  let getTransactionGroupSepaArray;

  /**
  * Public members
  */
  let generateJSON;
  let setReference;
  let setCurrency;
  let setDebtorAccount;
  let setDebtorEntity;
  let addTransaction;
  let addTransactions;
  let addTransactionGroup;
  let getTransactionIds;

  /**
   * PRIVATE FUNCTIONS
   */

  getTransactionGroup = transactionGroupId => {
    return my.transactionGroups[transactionGroupId];
  };

  isDebtorAccountValid = (transactionGroupId) => {
    const transactionGroup = getTransactionGroup(transactionGroupId);
    return !!transactionGroup.debtorAccount &&
      typeof transactionGroup.debtorAccount.name !== 'undefined' &&
      typeof transactionGroup.debtorAccount.BIC !== 'undefined' &&
      typeof transactionGroup.debtorAccount.IBAN !== 'undefined';
  };

  getErrors = () => {
    const errors = [];

    if (!my.reference) {
      errors.push('reference missing');
    }

    if (!my.debtorEntity) {
      errors.push('debtor entity missing');
    }

    if (!Object.keys(my.transactionGroups).length) {
      errors.push('need at least 1 transaction group');
    }

    Object.values(my.transactionGroups).forEach(
      transactionGroup => {
        if (!transactionGroup.currency) {
          errors.push(`${transactionGroup.id} currency missing`);
        }

        if (!isDebtorAccountValid(transactionGroup.id)) {
          errors.push(`${transactionGroup.id} has an invalid debtor account`);
        }
      }
    );

    return errors;
  };

  generateErrorString = errors => {
    const introMsg =
      'Could not generate SEPA payment object for the following reason(s)';
    return `${introMsg}: ${errors.join(',')}`;
  };

  /**
  * Private SEPA generators
  */

  getBaseSepaObject = () => ({
    GrpHdr: {
      MsgId: my.reference,
      CreDtTm: moment().toISOString(),
      Grpg: 'MIXD',
      InitgPty: {
        Nm: my.debtorEntity,
      },
    },
    PmtInf: [],
  });


  getTransactionGroupSepaObject = (transactionGroupId) => {
    const transactionGroup = getTransactionGroup(transactionGroupId);
    return {
      PmtInfId: transactionGroup.id,
      ReqdExctnDt: moment().format('YYYY-MM-DD'),
      Dbtr: {
        Nm: transactionGroup.debtorAccount.name,
      },
      DbtrAgt: {
        FinInstnId: {
          BIC: transactionGroup.debtorAccount.BIC,
        },
      },
      DbtrAcct: {
        Id: {
          IBAN: transactionGroup.debtorAccount.IBAN,
        },
        Ccy: transactionGroup.currency,
      },
      CdtTrfTxInf: transactionGroup.transactions,
    };
  };

  getTransactionGroupSepaArray = () => {
    return Object.keys(my.transactionGroups).map(
      transactionGroupId => getTransactionGroupSepaObject(transactionGroupId)
    );
  };

  /**
   * PUBLIC FUNCTIONS
   */

  setReference = reference => {
    my.reference = reference;
    return that;
  };

  setCurrency = (transactionGroupId, currency) => {
    const transactionGroup = getTransactionGroup(transactionGroupId);
    if (!transactionGroup) {
      throw new Error(
        'Cannot add currency to non existing transaction group:' +
        `"${transactionGroupId}"`
      );
    }
    transactionGroup.currency = currency;
    return that;
  };

  setDebtorAccount = (
    transactionGroupId,
    {
      name,
      BIC,
      IBAN,
    }
  ) => {
    const transactionGroup = getTransactionGroup(transactionGroupId);
    if (!transactionGroup) {
      throw new Error(
        'Cannot add debtor account to non existing transaction group:' +
        `"${transactionGroupId}"`
      );
    }
    transactionGroup.debtorAccount = {
      name,
      BIC,
      IBAN,
    };
    return that;
  };

  setDebtorEntity = debtorEntity => {
    my.debtorEntity = debtorEntity;
    return that;
  };

  addTransaction = (
    transactionGroupId,
    {
      reference,
      currency,
      amount,
      creditorName,
      creditorBIC,
      creditorIBAN,
      customFields = {},
    }
  ) => {
    const transactionGroup = getTransactionGroup(transactionGroupId);
    if (!transactionGroup) {
      throw new Error(
        'Cannot add transaction to non existing transaction group:' +
        `"${transactionGroupId}"`
      );
    }

    transactionGroup.transactions.push(Object.assign(
      {},
      customFields,
      {
        PmtId: {
          EndToEndId: reference,
        },
        Amt: {
          InstdAmt: {
            value: amount,
            currency,
          },
        },
        CdtrAgt: {
          FinInstnId: {
            BIC: creditorBIC,
          },
        },
        Cdtr: {
          Nm: creditorName,
        },
        CdtrAcct: {
          Id: {
            IBAN: creditorIBAN,
          },
        },
      }
    ));
    return that;
  };

  addTransactions = (transactionGroupId, transactionObjects) => {
    transactionObjects.forEach(
      transactionObject => addTransaction(transactionGroupId, transactionObject)
    );
    return that;
  };

  addTransactionGroup = (
    transactionGroupId,
    currency,
    debtorAccount,
    transactions = [],
  ) => {
    if (!my.transactionGroups[transactionGroupId]) {
      my.transactionGroups[transactionGroupId] = {
        id: transactionGroupId,
        transactions: [],
      };
    }
    if (currency) {
      setCurrency(transactionGroupId, currency);
    }
    if (debtorAccount) {
      setDebtorAccount(transactionGroupId, debtorAccount);
    }
    if (transactions.length) {
      addTransactions(transactionGroupId, transactions);
    }
    return that;
  };

  generateJSON = () => {
    const errors = getErrors();
    if (errors.length) {
      throw new Error(generateErrorString(errors));
    }
    const sepaPaymentObject = getBaseSepaObject();

    sepaPaymentObject.PmtInf = sepaPaymentObject.PmtInf.concat(
      getTransactionGroupSepaArray().filter(
        transactionGroup => transactionGroup.CdtTrfTxInf.length > 0
      )
    );

    sepaPaymentObject.GrpHdr.NbOfTxs = 0;
    sepaPaymentObject.GrpHdr.CtrlSum = 0;

    sepaPaymentObject.PmtInf.forEach(function (PmtInf) {
      sepaPaymentObject.GrpHdr.NbOfTxs += PmtInf.CdtTrfTxInf.length;
      PmtInf.CdtTrfTxInf.forEach(function (CdtTrfTxInf) {
        sepaPaymentObject.GrpHdr.CtrlSum += _.round(
          CdtTrfTxInf.Amt.InstdAmt.value,
          2
        );
      });
    });

    sepaPaymentObject.GrpHdr.CtrlSum = _.round(
      sepaPaymentObject.GrpHdr.CtrlSum,
      2
    );

    return sepaPaymentObject;
  };

  getTransactionIds = () => {
    const errors = getErrors();
    if (errors.length) {
      throw new Error(generateErrorString(errors));
    }

    let transactions = [];

    _.each(my.transactionGroups, (group) => {
      transactions = transactions.concat(
        group.transactions.map(transaction => transaction.transactionId)
      );
    });

    return transactions;
  };

  return Object.assign(that, {
    generateJSON,
    setReference,
    setCurrency,
    setDebtorAccount,
    setDebtorEntity,
    addTransaction,
    addTransactions,
    addTransactionGroup,
    getTransactionIds,
  });
};

module.exports = {
  init: sepaPayment,
};
