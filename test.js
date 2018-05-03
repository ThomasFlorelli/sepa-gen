/*
 * @file ACL component tests
 * @copyright Copyright (c) LaBelleAssiette 2015. All rights reserved.
 */

describe('sepa payment component', () => {
  const crypto = require('crypto');
  const sepaPaymentParser = require('./lib/parser.js');
  const sepaPaymentGen = require('./lib/sepa-gen');

  const sepaPaymentMocker = (function () {
    let that = {};
    const NAME_POOL = [
      'John',
      'Jack',
      'Bob',
      'Patricia',
      'Kimberley'
    ];

    /**
     * Private methods
     */

    /**
     * Public methods
     */
    let getRandomString;
    let getRandomNumber;
    let getReference;
    let getDebtorEntity;
    let getAmount;
    let getCurrency;
    let getDebtorAccount;
    let getCreditorName;
    let getTransaction;
    let getValidTransactionGroupDataSet;
    let getValidMockData;
    let getPrefilledSepaPaymentWithout;
    let getPrefilledSepaPayment;

    /**
     * Private
     */
    getRandomString = () => crypto.randomBytes(5).toString('hex');
    getRandomNumber = (max) => Math.round(Math.random() * max);

    /**
     * Public
     */
    getAmount = () => getRandomNumber(1000);
    getReference = () => getRandomString();
    getDebtorEntity = () => getRandomString();
    getCreditorName = () => {
      return NAME_POOL[getRandomNumber(NAME_POOL.length - 1)];
    };
    getCurrency = () => 'EUR';

    getDebtorAccount = () => ({
      name: getRandomString(),
      IBAN: getRandomString(),
      BIC: getRandomString(),
    });

    getTransaction = () => {
      return {
        reference: getReference(),
        currency: getCurrency(),
        amount: getAmount(),
        creditorName: getCreditorName(),
        creditorBIC: getRandomString(),
        creditorIBAN: getRandomString(),
      };
    };

    getValidTransactionGroupDataSet = () => ({
      id: getRandomString(),
      currency: getCurrency(),
      debtorAccount: getDebtorAccount(),
      transactions: [getTransaction()]
    });

    getValidMockData = () => ({
      reference: getReference(),
      transactionGroup: getValidTransactionGroupDataSet(),
      debtorEntity: getDebtorEntity(),
    });

    getPrefilledSepaPaymentWithout = (without = []) => {
      const mockData = getValidMockData();
      const sepaPaymentFillingSteps = {
        reference: sepaPayment => sepaPayment
          .setReference(mockData.reference),
        debtorEntity: sepaPayment => sepaPayment
          .setDebtorEntity(mockData.debtorEntity),
        transactionGroup: sepaPayment => sepaPayment.addTransactionGroup(
          mockData.transactionGroup.id,
          mockData.transactionGroup.currency,
          mockData.transactionGroup.debtorAccount,
          mockData.transactionGroup.transactions,
        ),
      };

      const sepaPayment = sepaPaymentGen.init();

      Object.keys(sepaPaymentFillingSteps).forEach(fieldLabel => {
        if (!without.includes(fieldLabel)) {
          sepaPaymentFillingSteps[fieldLabel](sepaPayment);
        }
      });

      return sepaPayment;
    };

    getPrefilledSepaPayment = () => getPrefilledSepaPaymentWithout();

    return Object.assign(that, {
      getRandomString,
      getRandomNumber,
      getPrefilledSepaPayment,
      getPrefilledSepaPaymentWithout,
      getReference,
      getDebtorEntity,
      getCurrency,
      getDebtorAccount,
      getTransaction,
      getValidTransactionGroupDataSet,
      getValidMockData,
    });
  }());

  const sepaPaymentTestUtilities = (function () {
    let that = {};

    /**
     * Private
     */

    /**
     * Public
     */
    let isSepaError;

    isSepaError = error => {
      return error.message.includes('Could not generate SEPA payment');
    };

    return Object.assign(that, {
      isSepaError,
    });
  }());

  describe('json generation flow', () => {
    describe('#setReference', () => {
      it('should save payment reference', () => {
        const reference = sepaPaymentMocker.getReference();
        const sepaTest = sepaPaymentParser(sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['reference'])
          .setReference(reference)
          .generateJSON());
        expect(sepaTest.getReference())
          .toEqual(reference);
      });
    });
    describe('#addTransactionGroup', () => {
      it('should save transaction groups', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();

        const sepaTest = sepaPaymentParser(sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            transactionGroup.transactions
          )
          .generateJSON());

        expect(sepaTest.hasTransactionGroup(transactionGroup.id)).toBe(true);
        expect(sepaTest.getCurrency(transactionGroup.id))
          .toEqual(transactionGroup.currency);
        expect(sepaTest.getDebtorName(transactionGroup.id))
          .toEqual(transactionGroup.debtorAccount.name);
        expect(sepaTest.getDebtorBIC(transactionGroup.id))
          .toEqual(transactionGroup.debtorAccount.BIC);
        expect(sepaTest.getDebtorIBAN(transactionGroup.id))
          .toEqual(transactionGroup.debtorAccount.IBAN);
      });

      it('should update transaction group', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const newCurrency = sepaPaymentMocker.getRandomString();

        const sepaTest = sepaPaymentParser(sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            transactionGroup.transactions
          )
          .addTransactionGroup(
            transactionGroup.id,
            newCurrency
          )
          .generateJSON());

        expect(sepaTest.getCurrency(transactionGroup.id))
          .toEqual(newCurrency);
        expect(sepaTest.getCurrency(transactionGroup.id))
          .not.toEqual(transactionGroup.currency);
      });

      it('should ignore transaction groups that have no transactions', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPayment()
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        expect(sepaTest.hasTransactionGroup(transactionGroup.id)).toBe(false);
        expect(sepaTest.countTransactionGroups()).toEqual(1);

        sepaPayment.addTransaction(
          transactionGroup.id,
          sepaPaymentMocker.getTransaction()
        );
        expect(
          sepaPaymentParser(sepaPayment.generateJSON())
            .hasTransactionGroup(transactionGroup.id)
        ).toBe(true);
      });

      describe('setCurrency', () => {
        it('should save transaction group currency', () => {
          const transactionGroup = sepaPaymentMocker
            .getValidTransactionGroupDataSet();
          const currency = sepaPaymentMocker.getRandomString();

          const sepaTest = sepaPaymentParser(sepaPaymentMocker
            .getPrefilledSepaPaymentWithout(['transactionGroup'])
            .addTransactionGroup(
              transactionGroup.id,
              transactionGroup.currency,
              transactionGroup.debtorAccount,
              transactionGroup.transactions
            )
            .setCurrency(transactionGroup.id, currency)
            .generateJSON());

          expect(sepaTest.getCurrency(transactionGroup.id))
            .not.toEqual(transactionGroup.currency);
          expect(sepaTest.getCurrency(transactionGroup.id))
            .toEqual(currency);
        });
        it('should fail if transaction group does not exist', () => {
          const id = sepaPaymentMocker.getRandomString();

          try {
            sepaPaymentMocker
              .getPrefilledSepaPayment()
              .setCurrency(id, 'EUR')
              .generateJSON();
          } catch (error) {
            expect(error.message).toEqual(
              `Cannot add currency to non existing transaction group:"${id}"`
            );
          }
        });
      });
      describe('#setDebtorAccount', () => {
        it('should save transaction group debtor account', () => {
          const transactionGroup = sepaPaymentMocker
            .getValidTransactionGroupDataSet();
          const debtorAccount = sepaPaymentMocker.getDebtorAccount();

          const sepaTest = sepaPaymentParser(sepaPaymentMocker
            .getPrefilledSepaPaymentWithout(['transactionGroup'])
            .addTransactionGroup(
              transactionGroup.id,
              transactionGroup.currency,
              transactionGroup.debtorAccount,
              transactionGroup.transactions
            )
            .setDebtorAccount(transactionGroup.id, debtorAccount)
            .generateJSON());

          expect(sepaTest.getDebtorName(transactionGroup.id))
            .toEqual(debtorAccount.name);
          expect(sepaTest.getDebtorName(transactionGroup.id))
            .not.toEqual(transactionGroup.debtorAccount.name);
          expect(sepaTest.getDebtorBIC(transactionGroup.id))
            .toEqual(debtorAccount.BIC);
          expect(sepaTest.getDebtorBIC(transactionGroup.id))
            .not.toEqual(transactionGroup.debtorAccount.BIC);
          expect(sepaTest.getDebtorIBAN(transactionGroup.id))
            .toEqual(debtorAccount.IBAN);
          expect(sepaTest.getDebtorIBAN(transactionGroup.id))
            .not.toEqual(transactionGroup.debtorAccount.IBAN);
        });
        it('should fail if transaction group does not exist', () => {
          const id = sepaPaymentMocker.getRandomString();
          const debtorAccount = sepaPaymentMocker.getDebtorAccount();

          try {
            sepaPaymentMocker
              .getPrefilledSepaPayment()
              .setDebtorAccount(id, debtorAccount)
              .generateJSON();
          } catch (error) {
            expect(error.message).toEqual(
              `Cannot add debtor account to non existing transaction group:"${id}"`
            );
          }
        });
      });
    });
    describe('#addTransaction', () => {
      it('should add 1 transaction to transaction group', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );

        const transactions = [
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
        ];

        transactions.forEach(transaction => {
          sepaPayment.addTransaction(
            transactionGroup.id,
            transaction
          );
        });

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        expect(sepaTest.countTransactions(transactionGroup.id)).toEqual(2);
        transactions.forEach(transaction => {
          expect(
            sepaTest.hasTransaction(transactionGroup.id, transaction.reference)
          ).toBe(true);
        });
      });
      it('should generate a correct transaction', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );

        const transactions = [
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
        ];

        transactions.forEach(transaction => {
          sepaPayment.addTransaction(
            transactionGroup.id,
            transaction
          );
        });

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        transactions.forEach(transaction => {
          expect(sepaTest.getTransactionAmount(
            transactionGroup.id,
            transaction.reference
          )).toEqual(transaction.amount);
          expect(sepaTest.getTransactionCurrency(
            transactionGroup.id,
            transaction.reference
          )).toEqual(transaction.currency);
          expect(sepaTest.getTransactionCreditorName(
            transactionGroup.id,
            transaction.reference
          )).toEqual(transaction.creditorName);
          expect(sepaTest.getTransactionCreditorBIC(
            transactionGroup.id,
            transaction.reference
          )).toEqual(transaction.creditorBIC);
          expect(sepaTest.getTransactionCreditorIBAN(
            transactionGroup.id,
            transaction.reference
          )).toEqual(transaction.creditorIBAN);
        });
      });
      it('should include custom fields', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );

        const transaction = sepaPaymentMocker.getTransaction();
        transaction.customFields = {
          foo: 'bar',
        };

        sepaPayment.addTransaction(
          transactionGroup.id,
          transaction
        );

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        expect(
          sepaTest.getTransactionCustomField(
            transactionGroup.id,
            transaction.reference,
            'foo'
          )
        ).toEqual(transaction.customFields.foo);
      });
      it('should fail if transaction group missing', () => {
        const id = sepaPaymentMocker.getRandomString();
        const transaction = sepaPaymentMocker.getTransaction();

        try {
          sepaPaymentMocker
            .getPrefilledSepaPayment()
            .addTransaction(id, transaction)
            .generateJSON();
        } catch (error) {
          expect(error.message).toEqual(
            `Cannot add transaction to non existing transaction group:"${id}"`
          );
        }
      });
    });
    describe('#addTransactions', () => {
      it('should add multiple transactions to transaction group', () => {
        const transactionGroup = sepaPaymentMocker
          .getValidTransactionGroupDataSet();
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup'])
          .addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );

        const transactions = [
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
        ];

        sepaPayment.addTransactions(
          transactionGroup.id,
          transactions
        );

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        expect(sepaTest.countTransactions(transactionGroup.id))
          .toEqual(transactions.length);
        transactions.forEach(transaction => {
          expect(
            sepaTest.hasTransaction(transactionGroup.id, transaction.reference)
          ).toBe(true);
        });
      });
      it('should fail if transaction group missing', () => {
        const id = sepaPaymentMocker.getRandomString();
        const transactions = [
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
        ];

        try {
          sepaPaymentMocker
            .getPrefilledSepaPayment()
            .addTransactions(id, transactions)
            .generateJSON();
        } catch (error) {
          expect(error.message).toEqual(
            `Cannot add transaction to non existing transaction group:"${id}"`
          );
        }
      });
    });
    describe('#generateJSON', () => {
      describe('error handling', () => {
        it('should fail if no reference', () => {
          try {
            sepaPaymentMocker
              .getPrefilledSepaPaymentWithout(['reference'])
              .generateJSON();
          } catch (error) {
            expect(sepaPaymentTestUtilities.isSepaError(error)).toBe(true);
            expect(error.message).toContain('reference missing');
          }
        });
        it('should fail if no debtorEntity', () => {
          try {
            sepaPaymentMocker
              .getPrefilledSepaPaymentWithout(['debtorEntity'])
              .generateJSON();
          } catch (error) {
            expect(sepaPaymentTestUtilities.isSepaError(error)).toBe(true);
            expect(error.message).toContain('debtor entity missing');
          }
        });
        it('should fail if no transaction group', () => {
          try {
            sepaPaymentMocker
              .getPrefilledSepaPaymentWithout(['transactionGroup'])
              .generateJSON();
          } catch (error) {
            expect(sepaPaymentTestUtilities.isSepaError(error)).toBe(true);
            expect(error.message).toContain('need at least 1 transaction group');
          }
        });
        it(
          'should fail if transaction group has missing currency',
          () => {
            const invalidTransactionGroup = sepaPaymentMocker
              .getValidTransactionGroupDataSet();

            delete invalidTransactionGroup.currency;
            try {
              sepaPaymentMocker
                .getPrefilledSepaPaymentWithout(['transactionGroup'])
                .addTransactionGroup(
                  invalidTransactionGroup.id,
                  invalidTransactionGroup.currency,
                  invalidTransactionGroup.debtorAccount,
                  invalidTransactionGroup.transactions
                )
                .generateJSON();
            } catch (error) {
              expect(sepaPaymentTestUtilities.isSepaError(error)).toBe(true);
              expect(error.message).toContain(
                `${invalidTransactionGroup.id} currency missing`
              );
            }
          }
        );
        it(
          'should fail if transaction group has invalid debtor account',
          () => {
            const invalidTransactionGroup = sepaPaymentMocker
              .getValidTransactionGroupDataSet();

            delete invalidTransactionGroup.debtorAccount.BIC;
            try {
              sepaPaymentMocker
                .getPrefilledSepaPaymentWithout(['transactionGroup'])
                .addTransactionGroup(
                  invalidTransactionGroup.id,
                  invalidTransactionGroup.currency,
                  invalidTransactionGroup.debtorAccount,
                  invalidTransactionGroup.transactions
                )
                .generateJSON();
            } catch (error) {
              expect(sepaPaymentTestUtilities.isSepaError(error)).toBe(true);
              expect(error.message).toContain(
                `${invalidTransactionGroup.id} has an invalid debtor account`
              );
            }
          }
        );
      });

      it('should count the right number of transactions', () => {
        const sepaPayment = sepaPaymentMocker
          .getPrefilledSepaPaymentWithout(['transactionGroup']);

        const transactionGroups = [
          sepaPaymentMocker
            .getValidTransactionGroupDataSet(),
          sepaPaymentMocker
            .getValidTransactionGroupDataSet(),
          sepaPaymentMocker
            .getValidTransactionGroupDataSet(),
        ];

        const transactions = [
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
          sepaPaymentMocker.getTransaction(),
        ];

        transactionGroups.forEach(transactionGroup => {
          sepaPayment.addTransactionGroup(
            transactionGroup.id,
            transactionGroup.currency,
            transactionGroup.debtorAccount,
            []
          );
        });

        sepaPayment.addTransactions(
          transactionGroups[0].id,
          [
            transactions[0],
            transactions[1],
            transactions[2],
          ]
        );
        sepaPayment.addTransaction(
          transactionGroups[1].id,
          transactions[3],
        );
        sepaPayment.addTransaction(
          transactionGroups[1].id,
          transactions[4],
        );
        sepaPayment.addTransaction(
          transactionGroups[2].id,
          transactions[5],
        );

        const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

        expect(sepaTest.getNumberOfTransactions()).toEqual(transactions.length);
      });

      describe('ctrlsum', () => {
        it('should generate a correct ctrlsum field', () => {
          const transactionGroup = sepaPaymentMocker
            .getValidTransactionGroupDataSet();
          const sepaPayment = sepaPaymentMocker
            .getPrefilledSepaPaymentWithout(['transactionGroup'])
            .addTransactionGroup(
              transactionGroup.id,
              transactionGroup.currency,
              transactionGroup.debtorAccount,
              []
            );

          let sepaTest;
          const transactions = [
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
          ];

          sepaPayment.addTransactions(
            transactionGroup.id,
            transactions
          );

          sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

          expect(sepaTest.getControlSum()).toEqual(transactions.reduce(
            (total, transaction) => {
              return total + transaction.amount;
            },
            0
          ));
        });
        it('should cumulate all transaction groups', () => {
          const sepaPayment = sepaPaymentMocker
            .getPrefilledSepaPaymentWithout(['transactionGroup']);

          const transactionGroups = [
            sepaPaymentMocker
              .getValidTransactionGroupDataSet(),
            sepaPaymentMocker
              .getValidTransactionGroupDataSet(),
            sepaPaymentMocker
              .getValidTransactionGroupDataSet(),
          ];

          const transactions = [
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
          ];

          transactionGroups.forEach(transactionGroup => {
            sepaPayment.addTransactionGroup(
              transactionGroup.id,
              transactionGroup.currency,
              transactionGroup.debtorAccount,
              []
            );
          });

          sepaPayment.addTransactions(
            transactionGroups[0].id,
            [
              transactions[0],
              transactions[1],
              transactions[2],
            ]
          );
          sepaPayment.addTransaction(
            transactionGroups[1].id,
            transactions[3],
          );
          sepaPayment.addTransaction(
            transactionGroups[1].id,
            transactions[4],
          );
          sepaPayment.addTransaction(
            transactionGroups[2].id,
            transactions[5],
          );

          const sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

          expect(sepaTest.getControlSum()).toEqual(transactions.reduce(
            (total, transaction) => {
              return total + transaction.amount;
            },
            0
          ));
        });
        it('should round number to handle decimal issues', () => {
          const transactionGroup = sepaPaymentMocker
            .getValidTransactionGroupDataSet();
          const sepaPayment = sepaPaymentMocker
            .getPrefilledSepaPaymentWithout(['transactionGroup'])
            .addTransactionGroup(
              transactionGroup.id,
              transactionGroup.currency,
              transactionGroup.debtorAccount,
              []
            );

          let sepaTest;
          const transactions = [
            sepaPaymentMocker.getTransaction(),
            sepaPaymentMocker.getTransaction(),
          ];
          transactions[0].amount = 231.349819872;
          transactions[1].amount = 987.7197924;

          sepaPayment.addTransactions(
            transactionGroup.id,
            transactions
          );

          sepaTest = sepaPaymentParser(sepaPayment.generateJSON());

          expect(sepaTest.getControlSum()).toEqual(transactions.reduce(
            (total, transaction) => {
              return total + Math.round(transaction.amount * 100) / 100;
            },
            0
          ));
        });
      });
    });
    describe('sepa payment object instances handling', () => {
      it('should generate separated instances', () => {
        const sepaTests = [
          sepaPaymentParser(
            sepaPaymentMocker.getPrefilledSepaPayment()
              .generateJSON()
          ),
          sepaPaymentParser(
            sepaPaymentMocker.getPrefilledSepaPayment()
              .generateJSON()
          )
        ];

        expect(
          sepaTests[0].getReference()
        ).not.toEqual(
          sepaTests[1].getReference()
        );
      });
    });
  });
});
