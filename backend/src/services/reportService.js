
const prisma = require("../config/prisma");

// Generate transaction report
async function getTransactionReport(startDate, endDate) {
  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      referenceNumber: true,
      type: true,
      amount: true,
      status: true,
      createdAt: true,
    },
  });

  const completed = transactions.filter(
    (transaction) => transaction.status === "COMPLETED"
  );

  const totalAmount = completed.reduce(
    (sum, transaction) => sum + Number(transaction.amount),
    0
  );

  return {
    totalTransactions: transactions.length,
    completedTransactions: completed.length,
    failedTransactions: transactions.filter(
      (transaction) => transaction.status === "FAILED"
    ).length,
    pendingTransactions: transactions.filter(
      (transaction) => transaction.status === "PENDING"
    ).length,
    completedTransactionAmount: totalAmount,
    transactions,
  };
}

// Generate account opening report
async function getAccountReport(startDate, endDate) {
  const accounts = await prisma.account.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      accountNumber: true,
      accountType: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    totalAccountsOpened: accounts.length,
    savingsAccounts: accounts.filter(
      (account) => account.accountType === "SAVINGS"
    ).length,
    currentAccounts: accounts.filter(
      (account) => account.accountType === "CURRENT"
    ).length,
    accounts,
  };
}

// Generate loan status report
async function getLoanReport(startDate, endDate) {
  const loans = await prisma.loan.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      referenceNumber: true,
      requestedAmount: true,
      tenureMonths: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    totalLoans: loans.length,
    submittedLoans: loans.filter(
      (loan) => loan.status === "SUBMITTED"
    ).length,
    approvedLoans: loans.filter(
      (loan) => loan.status === "APPROVED"
    ).length,
    rejectedLoans: loans.filter(
      (loan) => loan.status === "REJECTED"
    ).length,
    loans,
  };
}

module.exports = {
  getTransactionReport,
  getAccountReport,
  getLoanReport,
};
