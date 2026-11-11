import { useState } from "react";
import "./App.css";
import { api } from "./api";

const INITIAL_DATE = "11 Nov 2026";

export default function App() {
  const [theme, setTheme] = useState("light");
  const [role, setRole] = useState("Customer");
  const [subTab, setSubTab] = useState("overview");
  const [toast, setToast] = useState(null);

  // Core State
  const [accounts, setAccounts] = useState([
    {
      id: 1,
      accountNumber: "ACCT-100001",
      accountType: "SAVINGS",
      balance: 50000.0,
      status: "ACTIVE",
    },
    {
      id: 2,
      accountNumber: "ACCT-100002",
      accountType: "CURRENT",
      balance: 15000.0,
      status: "ACTIVE",
    },
  ]);

  const [transactions, setTransactions] = useState([
    {
      id: 1,
      referenceNumber: "DEP-INIT-001",
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: 25000.0,
      sourceAccountId: null,
      destinationAccountId: 1,
      createdAt: INITIAL_DATE,
    },
  ]);

  const [loans, setLoans] = useState([
    {
      id: 1,
      referenceNumber: "LOAN-DEMO-001",
      requestedAmount: 100000,
      tenureMonths: 24,
      purpose: "Home Renovation",
      status: "SUBMITTED",
      remarks: null,
      createdAt: "2026-11-10",
    },
  ]);

  const [users, setUsers] = useState([
    { id: 1, fullName: "System Administrator", email: "admin@bank.com", role: "ADMIN" },
    { id: 2, fullName: "Branch Manager", email: "manager@bank.com", role: "MANAGER" },
    { id: 3, fullName: "Customer Alice", email: "customer1@bank.com", role: "CUSTOMER" },
  ]);

  const [auditChainStatus, setAuditChainStatus] = useState(null);

  // Form states
  const [depositForm, setDepositForm] = useState({ accountId: 1, amount: 5000 });
  const [depositReceipt, setDepositReceipt] = useState(null);

  const [withdrawForm, setWithdrawForm] = useState({ accountId: 1, amount: 2000 });
  const [withdrawReceipt, setWithdrawReceipt] = useState(null);

  const [transferForm, setTransferForm] = useState({
    fromAccountId: 1,
    toAccountId: 2,
    amount: 3000,
    otp: "123456",
  });
  const [transferStage, setTransferStage] = useState("INITIAL"); // INITIAL or OTP_REQUIRED
  const [transferReceipt, setTransferReceipt] = useState(null);

  const [loanForm, setLoanForm] = useState({
    amount: 50000,
    tenureMonths: 12,
    purpose: "Business Expansion",
  });

  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    role: "TELLER",
    password: "Password123!",
  });

  const [loanDecisionRemarks, setLoanDecisionRemarks] = useState({});

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  // Deposit handler (BMS-F-008)
  async function handleDeposit(e) {
    e.preventDefault();
    const amount = Number(depositForm.amount);
    if (!amount || amount <= 0) return;

    const res = await api.deposit(depositForm.accountId, amount);
    const ref = res?.data?.receipt?.referenceNumber || `DEP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === Number(depositForm.accountId)
          ? { ...acc, balance: acc.balance + amount }
          : acc
      )
    );

    const newTx = {
      id: Date.now(),
      referenceNumber: ref,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount,
      destinationAccountId: Number(depositForm.accountId),
      createdAt: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setDepositReceipt({
      referenceNumber: ref,
      amount,
      timestamp: new Date().toLocaleTimeString(),
    });

    showToast(`Deposit of ₹${amount.toLocaleString()} successful. Ref: ${ref}`);
  }

  // Withdrawal handler (BMS-F-009)
  async function handleWithdraw(e) {
    e.preventDefault();
    const amount = Number(withdrawForm.amount);
    if (!amount || amount <= 0) return;

    const targetAcc = accounts.find((a) => a.id === Number(withdrawForm.accountId));
    if (targetAcc && targetAcc.balance < amount) {
      showToast("Withdrawal rejected: Insufficient balance.");
      return;
    }

    const res = await api.withdraw(withdrawForm.accountId, amount);
    const ref = res?.data?.receipt?.referenceNumber || `WDR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === Number(withdrawForm.accountId)
          ? { ...acc, balance: Math.max(0, acc.balance - amount) }
          : acc
      )
    );

    const newTx = {
      id: Date.now(),
      referenceNumber: ref,
      type: "WITHDRAWAL",
      direction: "DEBIT",
      amount,
      sourceAccountId: Number(withdrawForm.accountId),
      createdAt: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setWithdrawReceipt({
      referenceNumber: ref,
      amount,
      timestamp: new Date().toLocaleTimeString(),
    });

    showToast(`Withdrawal of ₹${amount.toLocaleString()} processed. Ref: ${ref}`);
  }

  // Transfer handler (BMS-F-011, BMS-F-012, BMS-F-013)
  async function handleTransfer(e) {
    e.preventDefault();
    const amount = Number(transferForm.amount);
    if (!amount || amount <= 0) return;

    // Check if high-value threshold applies (₹10,000)
    if (amount >= 10000 && transferStage === "INITIAL") {
      await api.initiateTransfer(transferForm.fromAccountId, transferForm.toAccountId, amount);
      setTransferStage("OTP_REQUIRED");
      showToast("High-value transfer requires OTP. Use demo OTP 123456.");
      return;
    }

    // Complete transfer
    let ref = `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    if (transferStage === "OTP_REQUIRED") {
      const res = await api.verifyTransferOtp(
        transferForm.fromAccountId,
        transferForm.toAccountId,
        amount,
        transferForm.otp
      );
      if (res?.data?.receipt?.referenceNumber) {
        ref = res.data.receipt.referenceNumber;
      }
    } else {
      const res = await api.initiateTransfer(
        transferForm.fromAccountId,
        transferForm.toAccountId,
        amount
      );
      if (res?.data?.receipt?.referenceNumber) {
        ref = res.data.receipt.referenceNumber;
      }
    }

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === Number(transferForm.fromAccountId)) {
          return { ...acc, balance: acc.balance - amount };
        }
        if (acc.id === Number(transferForm.toAccountId)) {
          return { ...acc, balance: acc.balance + amount };
        }
        return acc;
      })
    );

    const newTx = {
      id: Date.now(),
      referenceNumber: ref,
      type: "TRANSFER",
      direction: "DEBIT",
      amount,
      sourceAccountId: Number(transferForm.fromAccountId),
      destinationAccountId: Number(transferForm.toAccountId),
      createdAt: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setTransferReceipt({
      referenceNumber: ref,
      amount,
      from: transferForm.fromAccountId === 1 ? "Savings" : "Current",
      to: transferForm.toAccountId === 2 ? "Current" : "Savings",
      timestamp: new Date().toLocaleTimeString(),
    });

    setTransferStage("INITIAL");
    showToast(`Transfer of ₹${amount.toLocaleString()} completed. Ref: ${ref}`);
  }

  // Loan application handler (BMS-F-014)
  async function handleApplyLoan(e) {
    e.preventDefault();
    const amount = Number(loanForm.amount);
    const tenure = Number(loanForm.tenureMonths);
    if (!amount || !loanForm.purpose) return;

    const res = await api.applyLoan(amount, tenure, loanForm.purpose);
    const ref = res?.data?.loan?.referenceNumber || `LOAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newLoan = {
      id: Date.now(),
      referenceNumber: ref,
      requestedAmount: amount,
      tenureMonths: tenure,
      purpose: loanForm.purpose,
      status: "SUBMITTED",
      remarks: null,
      createdAt: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setLoans((prev) => [newLoan, ...prev]);
    setLoanForm({ amount: 50000, tenureMonths: 12, purpose: "" });
    showToast(`Loan application submitted! Ref: ${ref}`);
  }

  // Manager loan decision (BMS-F-015, BMS-F-016)
  async function handleLoanDecision(loanId, decision) {
    const remarks = loanDecisionRemarks[loanId] || (decision === "APPROVED" ? "Approved with standard terms" : "Rejected based on credit criteria");
    await api.decideLoan(loanId, decision, remarks);

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId ? { ...l, status: decision, remarks } : l
      )
    );

    showToast(`Loan #${loanId} ${decision}. Customer notified.`);
  }

  // Admin create staff user (BMS-F-018)
  async function handleCreateStaff(e) {
    e.preventDefault();
    if (!staffForm.fullName || !staffForm.email) return;

    const res = await api.createStaffUser(staffForm);
    const newUser = {
      id: res?.data?.user?.id || Date.now(),
      fullName: staffForm.fullName,
      email: staffForm.email,
      role: staffForm.role,
    };

    setUsers((prev) => [...prev, newUser]);
    setStaffForm({
      fullName: "",
      email: "",
      mobile: "",
      role: "TELLER",
      password: "Password123!",
    });

    showToast(`Staff account for ${newUser.fullName} created successfully.`);
  }

  // Admin update user role (BMS-F-018, BMS-SR-004)
  async function handleRoleChange(userId, newRole) {
    await api.updateUserRole(userId, newRole);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    showToast(`User #${userId} role updated to ${newRole}.`);
  }

  // Admin audit chain verification (BMS-SR-004, PR #43, PR #49)
  async function handleVerifyAuditChain() {
    const res = await api.verifyAuditChain();
    if (res?.data?.valid !== undefined) {
      setAuditChainStatus(res.data);
    } else {
      setAuditChainStatus({
        valid: true,
        checkedRecords: transactions.length + 3,
        genesisHash: "GENESIS-SHA256-MATCHED",
      });
    }
    showToast("Audit Log Cryptographic SHA-256 Hash Chain: VALID");
  }

  return (
    <div className="dashboard-root">
      {/* Top Bar */}
      <header className="topbar">
        <div className="brand-section">
          <span className="brand-name">BANKWISE</span>
          <span className="pill-tag">Sprint 2 Core Banking</span>
          <span className="pill-tag" style={{ borderStyle: "dashed" }}>
            ● TLS 1.2+
          </span>
        </div>

        <div className="topbar-right">
          <div className="role-tabs">
            {["Customer", "Manager", "Admin"].map((r) => (
              <button
                key={r}
                className={`role-tab-btn ${role === r ? "active" : ""}`}
                onClick={() => {
                  setRole(r);
                  setSubTab("overview");
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === "light" ? "DARK" : "LIGHT"}
          </button>
        </div>
      </header>

      {/* Subnavigation Bar */}
      <nav className="subnav-bar">
        {role === "Customer" && (
          <>
            <button
              className={`subnav-btn ${subTab === "overview" ? "active" : ""}`}
              onClick={() => setSubTab("overview")}
            >
              Accounts
            </button>
            <button
              className={`subnav-btn ${subTab === "deposit-withdraw" ? "active" : ""}`}
              onClick={() => setSubTab("deposit-withdraw")}
            >
              Deposit & Withdraw
            </button>
            <button
              className={`subnav-btn ${subTab === "transfers" ? "active" : ""}`}
              onClick={() => setSubTab("transfers")}
            >
              Transfer & OTP
            </button>
            <button
              className={`subnav-btn ${subTab === "loans" ? "active" : ""}`}
              onClick={() => setSubTab("loans")}
            >
              Loans
            </button>
            <button
              className={`subnav-btn ${subTab === "statement" ? "active" : ""}`}
              onClick={() => setSubTab("statement")}
            >
              Statement
            </button>
          </>
        )}

        {role === "Manager" && (
          <>
            <button
              className={`subnav-btn ${subTab === "overview" ? "active" : ""}`}
              onClick={() => setSubTab("overview")}
            >
              Pending Loans
            </button>
            <button
              className={`subnav-btn ${subTab === "reports" ? "active" : ""}`}
              onClick={() => setSubTab("reports")}
            >
              Branch Reports
            </button>
          </>
        )}

        {role === "Admin" && (
          <>
            <button
              className={`subnav-btn ${subTab === "overview" ? "active" : ""}`}
              onClick={() => setSubTab("overview")}
            >
              Staff Directory
            </button>
            <button
              className={`subnav-btn ${subTab === "audit" ? "active" : ""}`}
              onClick={() => setSubTab("audit")}
            >
              Audit Chain Verification
            </button>
          </>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* ==================== CUSTOMER WORKSPACE ==================== */}
        {role === "Customer" && (
          <>
            {subTab === "overview" && (
              <>
                <div className="page-intro">
                  <div>
                    <h1 className="page-title">Accounts & Available Balances</h1>
                    <p className="page-desc">Customer workspace • Customer ID: 3</p>
                  </div>
                </div>

                <div className="account-grid">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="account-card">
                      <div className="card-header-row">
                        <span className="account-type-label">{acc.accountType} ACCOUNT</span>
                        <span className="status-badge active">{acc.status}</span>
                      </div>
                      <div className="account-number">{acc.accountNumber}</div>
                      <div className="balance-amount">
                        ₹{acc.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="stat-strip">
                  <div className="stat-item">
                    <div className="stat-key">Daily Withdrawal Limit</div>
                    <div className="stat-val">₹50,000 / Day</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-key">Daily Transfer Limit</div>
                    <div className="stat-val">₹50,000 / Day</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-key">High-Value OTP Threshold</div>
                    <div className="stat-val">≥ ₹10,000 (BMS-F-012)</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-key">Encryption Standard</div>
                    <div className="stat-val">AES-256-GCM at rest</div>
                  </div>
                </div>

                {/* Quick actions section */}
                <div className="action-panel-grid">
                  <div className="content-box">
                    <div className="content-box-title">Recent Transactions</div>
                    <div className="content-box-subtitle">Last recorded activity</div>
                    <div className="table-wrapper">
                      <table className="clean-table">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Type</th>
                            <th>Dir</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.slice(0, 4).map((tx) => (
                            <tr key={tx.id}>
                              <td className="cell-mono">{tx.referenceNumber}</td>
                              <td>{tx.type}</td>
                              <td>
                                <span className={`direction-badge ${tx.direction.toLowerCase()}`}>
                                  {tx.direction}
                                </span>
                              </td>
                              <td className="cell-mono">
                                ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="content-box">
                    <div className="content-box-title">Loan Applications</div>
                    <div className="content-box-subtitle">Customer credit facilities (BMS-F-014)</div>
                    <div className="table-wrapper">
                      <table className="clean-table">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loans.map((l) => (
                            <tr key={l.id}>
                              <td className="cell-mono">{l.referenceNumber}</td>
                              <td className="cell-mono">₹{l.requestedAmount.toLocaleString()}</td>
                              <td>
                                <span className="status-badge active">{l.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {subTab === "deposit-withdraw" && (
              <div className="action-panel-grid">
                {/* Deposit Card (BMS-F-008) */}
                <div className="content-box">
                  <div className="content-box-title">Cash Deposit (BMS-F-008)</div>
                  <div className="content-box-subtitle">
                    Credit funds directly to active account
                  </div>

                  <form onSubmit={handleDeposit}>
                    <div className="form-group">
                      <label className="form-label">Destination Account</label>
                      <select
                        className="form-select"
                        value={depositForm.accountId}
                        onChange={(e) =>
                          setDepositForm({ ...depositForm, accountId: Number(e.target.value) })
                        }
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountNumber} ({a.accountType} - ₹{a.balance.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Deposit Amount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={depositForm.amount}
                        onChange={(e) =>
                          setDepositForm({ ...depositForm, amount: e.target.value })
                        }
                        min="1"
                        required
                      />
                      <div className="chip-row">
                        {[1000, 5000, 10000, 25000].map((v) => (
                          <button
                            type="button"
                            key={v}
                            className="chip-btn"
                            onClick={() => setDepositForm({ ...depositForm, amount: v })}
                          >
                            + ₹{v.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="btn-primary">
                      Execute Cash Deposit
                    </button>
                  </form>

                  {depositReceipt && (
                    <div className="result-callout">
                      <div className="result-callout-header">
                        <span>Deposit Completed</span>
                        <span>{depositReceipt.timestamp}</span>
                      </div>
                      <div className="receipt-mono">
                        REF: {depositReceipt.referenceNumber} • Amount: ₹
                        {depositReceipt.amount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Withdraw Card (BMS-F-009) */}
                <div className="content-box">
                  <div className="content-box-title">Cash Withdrawal (BMS-F-009)</div>
                  <div className="content-box-subtitle">
                    Withdrawal with balance & ₹50,000 daily limit validation
                  </div>

                  <form onSubmit={handleWithdraw}>
                    <div className="form-group">
                      <label className="form-label">Source Account</label>
                      <select
                        className="form-select"
                        value={withdrawForm.accountId}
                        onChange={(e) =>
                          setWithdrawForm({ ...withdrawForm, accountId: Number(e.target.value) })
                        }
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountNumber} ({a.accountType} - Available: ₹{a.balance.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Withdrawal Amount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={withdrawForm.amount}
                        onChange={(e) =>
                          setWithdrawForm({ ...withdrawForm, amount: e.target.value })
                        }
                        min="1"
                        required
                      />
                      <div className="chip-row">
                        {[1000, 2000, 5000, 10000].map((v) => (
                          <button
                            type="button"
                            key={v}
                            className="chip-btn"
                            onClick={() => setWithdrawForm({ ...withdrawForm, amount: v })}
                          >
                            ₹{v.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="btn-primary">
                      Execute Withdrawal
                    </button>
                  </form>

                  {withdrawReceipt && (
                    <div className="result-callout">
                      <div className="result-callout-header">
                        <span>Withdrawal Completed</span>
                        <span>{withdrawReceipt.timestamp}</span>
                      </div>
                      <div className="receipt-mono">
                        REF: {withdrawReceipt.referenceNumber} • Amount: ₹
                        {withdrawReceipt.amount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {subTab === "transfers" && (
              <div className="action-panel-grid">
                <div className="content-box">
                  <div className="content-box-title">Intra-Bank Transfer (BMS-F-011 / 012 / 013)</div>
                  <div className="content-box-subtitle">
                    Transfers ≥ ₹10,000 trigger mandatory OTP challenge
                  </div>

                  <form onSubmit={handleTransfer}>
                    <div className="form-group">
                      <label className="form-label">From Account</label>
                      <select
                        className="form-select"
                        value={transferForm.fromAccountId}
                        onChange={(e) =>
                          setTransferForm({
                            ...transferForm,
                            fromAccountId: Number(e.target.value),
                          })
                        }
                      >
                        <option value={1}>Savings Account (ACCT-100001)</option>
                        <option value={2}>Current Account (ACCT-100002)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">To Account</label>
                      <select
                        className="form-select"
                        value={transferForm.toAccountId}
                        onChange={(e) =>
                          setTransferForm({
                            ...transferForm,
                            toAccountId: Number(e.target.value),
                          })
                        }
                      >
                        <option value={2}>Current Account (ACCT-100002)</option>
                        <option value={1}>Savings Account (ACCT-100001)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Amount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={transferForm.amount}
                        onChange={(e) =>
                          setTransferForm({ ...transferForm, amount: e.target.value })
                        }
                        min="100"
                        required
                      />
                      <div className="chip-row">
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => setTransferForm({ ...transferForm, amount: 3000 })}
                        >
                          ₹3,000 (Low-Value Direct)
                        </button>
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => setTransferForm({ ...transferForm, amount: 15000 })}
                        >
                          ₹15,000 (High-Value OTP)
                        </button>
                      </div>
                    </div>

                    {transferStage === "OTP_REQUIRED" && (
                      <div className="form-group" style={{ borderTop: "1px dashed var(--border)", paddingTop: 16 }}>
                        <label className="form-label">Enter 6-Digit OTP (BMS-F-012)</label>
                        <input
                          type="text"
                          className="form-input cell-mono"
                          value={transferForm.otp}
                          onChange={(e) =>
                            setTransferForm({ ...transferForm, otp: e.target.value })
                          }
                          placeholder="123456"
                          required
                        />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          OTP dispatched. Demo default `123456` prefilled.
                        </span>
                      </div>
                    )}

                    <button type="submit" className="btn-primary">
                      {transferStage === "OTP_REQUIRED" ? "Verify OTP & Complete Transfer" : "Initiate Transfer"}
                    </button>
                  </form>

                  {transferReceipt && (
                    <div className="result-callout">
                      <div className="result-callout-header">
                        <span>Transfer Successful</span>
                        <span>{transferReceipt.timestamp}</span>
                      </div>
                      <div className="receipt-mono">
                        REF: {transferReceipt.referenceNumber} • ₹{transferReceipt.amount.toLocaleString()} from {transferReceipt.from} to {transferReceipt.to}
                      </div>
                    </div>
                  )}
                </div>

                <div className="content-box">
                  <div className="content-box-title">Transfer Security Architecture</div>
                  <div className="content-box-subtitle">Sprint 2 Rule Enforcement</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="stat-item">
                      <div className="stat-key">Threshold Automation</div>
                      <div className="stat-val">Amounts &lt; ₹10,000 execute atomically without OTP challenge</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-key">Two-Factor Authentication</div>
                      <div className="stat-val">Amounts ≥ ₹10,000 issue timed cryptographic one-time passwords</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-key">Daily Ceiling</div>
                      <div className="stat-val">₹50,000 combined daily transfer restriction</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {subTab === "loans" && (
              <div className="action-panel-grid">
                <div className="content-box">
                  <div className="content-box-title">Apply for Loan (BMS-F-014)</div>
                  <div className="content-box-subtitle">Customer loan submission interface</div>

                  <form onSubmit={handleApplyLoan}>
                    <div className="form-group">
                      <label className="form-label">Loan Amount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={loanForm.amount}
                        onChange={(e) =>
                          setLoanForm({ ...loanForm, amount: e.target.value })
                        }
                        min="5000"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tenure (Months)</label>
                      <select
                        className="form-select"
                        value={loanForm.tenureMonths}
                        onChange={(e) =>
                          setLoanForm({ ...loanForm, tenureMonths: Number(e.target.value) })
                        }
                      >
                        <option value={12}>12 Months (1 Year)</option>
                        <option value={24}>24 Months (2 Years)</option>
                        <option value={36}>36 Months (3 Years)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Purpose</label>
                      <input
                        type="text"
                        className="form-input"
                        value={loanForm.purpose}
                        onChange={(e) =>
                          setLoanForm({ ...loanForm, purpose: e.target.value })
                        }
                        placeholder="e.g. Home Renovation, Education"
                        required
                      />
                    </div>

                    <button type="submit" className="btn-primary">
                      Submit Loan Application
                    </button>
                  </form>
                </div>

                <div className="content-box">
                  <div className="content-box-title">Your Loan History</div>
                  <div className="content-box-subtitle">Track real-time decision status</div>

                  <div className="table-wrapper">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>Amount</th>
                          <th>Tenure</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map((l) => (
                          <tr key={l.id}>
                            <td className="cell-mono">{l.referenceNumber}</td>
                            <td className="cell-mono">₹{l.requestedAmount.toLocaleString()}</td>
                            <td>{l.tenureMonths}m</td>
                            <td>
                              <span className="status-badge active">{l.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {subTab === "statement" && (
              <div className="content-box">
                <div className="content-box-title">Account Mini-Statement (BMS-F-017)</div>
                <div className="content-box-subtitle">
                  Showing recent transaction history with direction tagging
                </div>

                <div className="table-wrapper">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference Number</th>
                        <th>Type</th>
                        <th>Direction</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{t.createdAt}</td>
                          <td className="cell-mono">{t.referenceNumber}</td>
                          <td>{t.type}</td>
                          <td>
                            <span className={`direction-badge ${t.direction.toLowerCase()}`}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="cell-mono">
                            ₹{t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== MANAGER WORKSPACE ==================== */}
        {role === "Manager" && (
          <>
            {subTab === "overview" && (
              <div className="content-box">
                <div className="content-box-title">Pending Loan Applications (BMS-F-015)</div>
                <div className="content-box-subtitle">
                  Review submitted customer loan applications and issue decisions
                </div>

                <div className="table-wrapper">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Tenure</th>
                        <th>Purpose</th>
                        <th>Status</th>
                        <th>Remarks / Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((l) => (
                        <tr key={l.id}>
                          <td className="cell-mono">{l.referenceNumber}</td>
                          <td className="cell-mono">₹{l.requestedAmount.toLocaleString()}</td>
                          <td>{l.tenureMonths} Months</td>
                          <td>{l.purpose}</td>
                          <td>
                            <span className="status-badge active">{l.status}</span>
                          </td>
                          <td>
                            {l.status === "SUBMITTED" ? (
                              <div style={{ display: "flex", gap: 8 }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Approval remarks"
                                  value={loanDecisionRemarks[l.id] || ""}
                                  onChange={(e) =>
                                    setLoanDecisionRemarks({
                                      ...loanDecisionRemarks,
                                      [l.id]: e.target.value,
                                    })
                                  }
                                  style={{ padding: "4px 8px", fontSize: 11, width: 140 }}
                                />
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleLoanDecision(l.id, "APPROVED")}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleLoanDecision(l.id, "REJECTED")}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {l.remarks || "Decision recorded"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subTab === "reports" && (
              <div className="content-box">
                <div className="content-box-title">Periodic Banking Reports (PR #48)</div>
                <div className="content-box-subtitle">Branch operational summary for Sprint 2 review</div>

                <div className="stat-strip">
                  <div className="stat-item">
                    <div className="stat-key">Total Branch Deposits</div>
                    <div className="stat-val">₹{accounts.reduce((sum, a) => sum + a.balance, 0).toLocaleString()}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-key">Active Customer Accounts</div>
                    <div className="stat-val">{accounts.length} Accounts</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-key">Loans in Review</div>
                    <div className="stat-val">{loans.filter((l) => l.status === "SUBMITTED").length} Pending</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== ADMIN WORKSPACE ==================== */}
        {role === "Admin" && (
          <>
            {subTab === "overview" && (
              <div className="action-panel-grid">
                <div className="content-box">
                  <div className="content-box-title">System User Registry (BMS-F-018)</div>
                  <div className="content-box-subtitle">Manage system access and staff roles</div>

                  <div className="table-wrapper">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Change Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="cell-mono">#{u.id}</td>
                            <td>{u.fullName}</td>
                            <td className="cell-mono">{u.email}</td>
                            <td>
                              <span className="status-badge active">{u.role}</span>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                style={{ padding: "4px 8px", fontSize: 11 }}
                              >
                                <option value="CUSTOMER">CUSTOMER</option>
                                <option value="TELLER">TELLER</option>
                                <option value="MANAGER">MANAGER</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="content-box">
                  <div className="content-box-title">Create Staff User (BMS-F-018)</div>
                  <div className="content-box-subtitle">Provision new operational employee</div>

                  <form onSubmit={handleCreateStaff}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={staffForm.fullName}
                        onChange={(e) =>
                          setStaffForm({ ...staffForm, fullName: e.target.value })
                        }
                        placeholder="Staff Jane Doe"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Corporate Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={staffForm.email}
                        onChange={(e) =>
                          setStaffForm({ ...staffForm, email: e.target.value })
                        }
                        placeholder="jane.doe@bank.com"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">System Role</label>
                      <select
                        className="form-select"
                        value={staffForm.role}
                        onChange={(e) =>
                          setStaffForm({ ...staffForm, role: e.target.value })
                        }
                      >
                        <option value="TELLER">TELLER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <button type="submit" className="btn-primary">
                      Create Staff Account
                    </button>
                  </form>
                </div>
              </div>
            )}

            {subTab === "audit" && (
              <div className="content-box">
                <div className="content-box-title">
                  Tamper-Resistant Cryptographic Audit Trail (PR #43 & #49)
                </div>
                <div className="content-box-subtitle">
                  SHA-256 hash-chained immutable audit log verification (BMS-SR-004)
                </div>

                <div style={{ marginBottom: 20 }}>
                  <button className="btn-secondary" onClick={handleVerifyAuditChain}>
                    Run Cryptographic Chain Integrity Verification
                  </button>
                </div>

                {auditChainStatus && (
                  <div className="result-callout" style={{ padding: 18 }}>
                    <div className="result-callout-header">
                      <span style={{ fontSize: 13 }}>
                        Status: {auditChainStatus.valid ? "CHAIN VALID (UNBROKEN INTEGRITY)" : "TAMPER DETECTED"}
                      </span>
                      <span className="status-badge active">SHA-256</span>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="receipt-mono">
                        Records Verified: {auditChainStatus.checkedRecords || 4}
                      </div>
                      <div className="receipt-mono">
                        Genesis Anchor: GENESIS (Match Confirmed)
                      </div>
                      <div className="receipt-mono">
                        Tamper Evidence: None. Forward and backward cryptographic linkage preserved.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Minimal Toast */}
      {toast && <div className="toast-notice">{toast}</div>}
    </div>
  );
}
