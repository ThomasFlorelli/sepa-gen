const _ = require('lodash');

const sepaPaymentParser = function (json) {
  let that = {};
  const paths = {
    paymentReference: 'GrpHdr.MsgId',
    controlSum: 'GrpHdr.CtrlSum',
    numberOfTransactions: 'GrpHdr.NbOfTxs',
    transactionGroups: 'PmtInf',
    transactionGroup: {
      id: 'PmtInfId',
      currency: 'DbtrAcct.Ccy',
      debtorName: 'Dbtr.Nm',
      debtorBIC: 'DbtrAgt.FinInstnId.BIC',
      debtorIBAN: 'DbtrAcct.Id.IBAN',
      transactions: 'CdtTrfTxInf'
    },
    transaction: {
      reference: 'PmtId.EndToEndId',
      amount: 'Amt.InstdAmt.value',
      currency: 'Amt.InstdAmt.currency',
      creditorName: 'Cdtr.Nm',
      creditorBIC: 'CdtrAgt.FinInstnId.BIC',
      creditorIBAN: 'CdtrAcct.Id.IBAN',
    },
  };

  /**
   * Private
   */
  let extractTransactionGroupData;
  let extractTransactionData;
  let getTransactionGroup;
  let getTransactions;
  let getTransaction;

  /**
   * Public
   */
  let getReference;
  let getControlSum;
  let getNumberOfTransactions;
  let hasTransactionGroup;
  let countTransactionGroups;
  let getCurrency;
  let getDebtorName;
  let getDebtorBIC;
  let getDebtorIBAN;
  let countTransactions;
  let hasTransaction;
  let getTransactionAmount;
  let getTransactionCurrency;
  let getTransactionCreditorName;
  let getTransactionCreditorBIC;
  let getTransactionCreditorIBAN;
  let getTransactionCustomField;

  extractTransactionGroupData = (transactionGroup, key) => {
    return _.get(transactionGroup, paths.transactionGroup[key]);
  };

  extractTransactionData = (transaction, key) => {
    return _.get(transaction, paths.transaction[key]);
  };

  getTransactionGroup = transactionGroupId => {
    return _.get(json, paths.transactionGroups)
      .find(transactionGroup => {
        return extractTransactionGroupData(
          transactionGroup,
          'id'
        ) === transactionGroupId;
      });
  };

  getTransactions = transactionGroupId => {
    return extractTransactionGroupData(
      getTransactionGroup(transactionGroupId),
      'transactions'
    );
  };

  getTransaction = (transactionGroupId, reference) => {
    return getTransactions(transactionGroupId).find(transaction => {
      return extractTransactionData(transaction, 'reference') === reference;
    });
  };

  getReference = () => {
    return _.get(json, paths.paymentReference);
  };

  getControlSum = () => {
    return _.get(json, paths.controlSum);
  };

  getNumberOfTransactions = () => {
    return _.get(json, paths.numberOfTransactions);
  };

  hasTransactionGroup = transactionGroupId => {
    return !!countTransactionGroups() &&
      !!getTransactionGroup(transactionGroupId);
  };

  countTransactionGroups = () => {
    return _.get(json, paths.transactionGroups).length;
  };

  getCurrency = transactionGroupId => {
    return _.get(
      getTransactionGroup(transactionGroupId),
      paths.transactionGroup.currency
    );
  };

  getDebtorName = transactionGroupId => {
    return extractTransactionGroupData(
      getTransactionGroup(transactionGroupId),
      'debtorName'
    );
  };

  getDebtorBIC = transactionGroupId => {
    return extractTransactionGroupData(
      getTransactionGroup(transactionGroupId),
      'debtorBIC'
    );
  };

  getDebtorIBAN = transactionGroupId => {
    return extractTransactionGroupData(
      getTransactionGroup(transactionGroupId),
      'debtorIBAN'
    );
  };

  countTransactions = transactionGroupId => {
    return _.get(getTransactions(transactionGroupId), 'length', 0);
  };

  hasTransaction = (transactionGroupId, reference) => {
    return !!getTransaction(transactionGroupId, reference);
  };

  getTransactionAmount = (transactionGroupId, reference) => {
    return extractTransactionData(
      getTransaction(transactionGroupId, reference),
      'amount'
    );
  };

  getTransactionCurrency = (transactionGroupId, reference) => {
    return extractTransactionData(
      getTransaction(transactionGroupId, reference),
      'currency'
    );
  };
  getTransactionCreditorName = (transactionGroupId, reference) => {
    return extractTransactionData(
      getTransaction(transactionGroupId, reference),
      'creditorName'
    );
  };
  getTransactionCreditorBIC = (transactionGroupId, reference) => {
    return extractTransactionData(
      getTransaction(transactionGroupId, reference),
      'creditorBIC'
    );
  };

  getTransactionCreditorIBAN = (transactionGroupId, reference) => {
    return extractTransactionData(
      getTransaction(transactionGroupId, reference),
      'creditorIBAN'
    );
  };

  getTransactionCustomField = (transactionGroupId, reference, fieldLabel) => {
    return getTransaction(transactionGroupId, reference)[fieldLabel];
  };

  return Object.assign(that, {
    getReference,
    getControlSum,
    getNumberOfTransactions,
    hasTransactionGroup,
    countTransactionGroups,
    getCurrency,
    getDebtorName,
    getDebtorBIC,
    getDebtorIBAN,
    countTransactions,
    hasTransaction,
    getTransactionAmount,
    getTransactionCurrency,
    getTransactionCreditorName,
    getTransactionCreditorBIC,
    getTransactionCreditorIBAN,
    getTransactionCustomField,
  });
};

module.exports = sepaPaymentParser;
