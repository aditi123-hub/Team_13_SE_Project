// API Service for Bank Management System (Sprint 2)

const TOKENS = {
  Customer:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGUiOiJDVVNUT01FUiIsInNlc3Npb25JZCI6ImRlbW8tc2Vzc2lvbi1jdXN0b21lcjEiLCJpYXQiOjE3OTQ0MDQxNzMsImV4cCI6MTc5Njk5NjE3M30.5nSQFtqyE1ZJQFPChhRDzkk5SvCT6Ulv9eKUM0tgYfo",
  Manager:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJNQU5BR0VSIiwic2Vzc2lvbklkIjoiZGVtby1zZXNzaW9uLW1hbmFnZXIiLCJpYXQiOjE3OTQ0MDQxNzMsImV4cCI6MTc5Njk5NjE3M30.oKDz4t3h9MQOAk_utRVZsdMPHGG7YrN1h1-D0rqd1fg",
  Admin:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJBRE1JTiIsInNlc3Npb25JZCI6ImRlbW8tc2Vzc2lvbi1hZG1pbiIsImlhdCI6MTc5NDQwNDE3MywiZXhwIjoxNzk2OTk2MTczfQ.3kZDsm5TmyFgAGhG-TiYekkJ8CakXr5mtT8IQOqCV6Q",
};

async function request(endpoint, options = {}, role = "Customer") {
  const token = TOKENS[role] || TOKENS.Customer;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, data: null };
  }
}

export const api = {
  deposit: (accountId, amount) =>
    request(`/accounts/${accountId}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(amount) }),
    }, "Customer"),

  withdraw: (accountId, amount) =>
    request(`/accounts/${accountId}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(amount) }),
    }, "Customer"),

  initiateTransfer: (fromAccountId, toAccountId, amount) =>
    request("/transfers/initiate", {
      method: "POST",
      body: JSON.stringify({
        fromAccountId: Number(fromAccountId),
        toAccountId: Number(toAccountId),
        amount: Number(amount),
      }),
    }, "Customer"),

  verifyTransferOtp: (fromAccountId, toAccountId, amount, otp) =>
    request("/transfers/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        fromAccountId: Number(fromAccountId),
        toAccountId: Number(toAccountId),
        amount: Number(amount),
        otp: String(otp).trim(),
      }),
    }, "Customer"),

  getMiniStatement: (accountId) =>
    request(`/statements/${accountId}/mini`, { method: "GET" }, "Customer"),

  getFullStatement: (accountId, from = "2026-10-01", to = "2026-11-30") =>
    request(`/statements/${accountId}/full?from=${from}&to=${to}`, {
      method: "GET",
    }, "Customer"),

  applyLoan: (amount, tenureMonths, purpose) =>
    request("/loans/apply", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(amount),
        tenureMonths: Number(tenureMonths),
        purpose: String(purpose).trim(),
      }),
    }, "Customer"),

  getPendingLoans: () =>
    request("/loans/pending", { method: "GET" }, "Manager"),

  decideLoan: (loanId, decision, remarks) =>
    request(`/loans/decision/${loanId}`, {
      method: "POST",
      body: JSON.stringify({ decision, remarks }),
    }, "Manager"),

  activateAccount: (accountId) =>
    request(`/accounts/${accountId}/activate`, { method: "POST" }, "Manager"),

  getUsers: () =>
    request("/admin/users", { method: "GET" }, "Admin"),

  createStaffUser: (userData) =>
    request("/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }, "Admin"),

  updateUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }, "Admin"),

  verifyAuditChain: () =>
    request("/audit-logs/verify", { method: "GET" }, "Admin"),

  getReports: () =>
    request(
      "/api/reports?type=transactions&startDate=2026-10-01&endDate=2026-11-30&format=json",
      { method: "GET" },
      "Manager"
    ),
};

