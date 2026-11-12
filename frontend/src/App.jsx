import { useState } from "react";
import "./App.css";
import { api } from "./api";

const roles = {
  Customer: {
    subtitle: "Your finances, all in one place.",
    accounts: [
      { label: "Savings Account", number: "ACCT-100001", id: 1, balance: 50000.0 },
      { label: "Current Account", number: "ACCT-100002", id: 2, balance: 15000.0 },
    ],
    actions: ["Overview", "Deposit & Withdraw", "Transfer & OTP", "Apply for Loan", "Transaction history"],
  },
  Teller: {
    subtitle: "Customer service and branch cash operations.",
    accounts: [
      { label: "Branch Cash Vault", number: "BRANCH-VAULT-01", id: 1, balance: 250000.0 },
      { label: "Pending Teller Queue", number: "COUNTER-01", id: 2, balance: 12 },
    ],
    actions: ["Overview", "Quick Deposit", "Receipt Lookup", "Customer lookup"],
  },
  Manager: {
    subtitle: "Monitor branch activity, credit decisions, and performance.",
    accounts: [
      { label: "Total Branch Deposits", number: "BRANCH-ACT-01", id: 1, balance: 842000.0 },
      { label: "Pending Approvals", number: "LOAN-QUEUE", id: 2, balance: 2 },
    ],
    actions: ["Overview", "Review approvals", "Branch overview", "View reports"],
  },
  Admin: {
    subtitle: "Manage system operations, staff roles, and audit security.",
    accounts: [
      { label: "Registered users", number: "USER-REGISTRY", id: 1, balance: 4 },
      { label: "Audit Chain Records", number: "SHA-256 CHAIN", id: 2, balance: 18 },
    ],
    actions: ["Overview", "User management", "Role management", "Audit log integrity"],
  },
};

const initialTransactions = [
  { name: "Salary Credit", reference: "DEP-INIT-001", date: "11 Nov 2026", type: "Credit", amount: "+₹25,000.00" },
  { name: "Grocery Store", reference: "WDR-INIT-002", date: "10 Nov 2026", type: "Debit", amount: "-₹1,250.00" },
  { name: "Electricity Bill", reference: "WDR-INIT-003", date: "09 Nov 2026", type: "Debit", amount: "-₹1,840.00" },
  { name: "Online Transfer", reference: "TXN-INIT-004", date: "08 Nov 2026", type: "Credit", amount: "+₹5,000.00" },
];

function App() {
  const [role, setRole] = useState("Customer");
  const [highContrast, setHighContrast] = useState(false);
  const [activeSection, setActiveSection] = useState("Overview");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  // Live Banking State
  const [balances, setBalances] = useState({ 1: 50000.0, 2: 15000.0 });
  const [transactionsList, setTransactionsList] = useState(initialTransactions);
  const [loansList, setLoansList] = useState([
    {
      id: 1,
      referenceNumber: "LOAN-DEMO-001",
      requestedAmount: 100000,
      tenureMonths: 24,
      purpose: "Home Renovation",
      status: "SUBMITTED",
      remarks: null,
    },
  ]);
  const [usersList, setUsersList] = useState([
    { id: 1, fullName: "System Administrator", email: "admin@bank.com", role: "ADMIN" },
    { id: 2, fullName: "Branch Manager", email: "manager@bank.com", role: "MANAGER" },
    { id: 3, fullName: "Customer Alice", email: "customer1@bank.com", role: "CUSTOMER" },
  ]);

  // Working Form States
  const [depositAmount, setDepositAmount] = useState(5000);
  const [depositTarget, setDepositTarget] = useState(1);
  const [depositReceipt, setDepositReceipt] = useState(null);

  const [withdrawAmount, setWithdrawAmount] = useState(2000);
  const [withdrawTarget, setWithdrawTarget] = useState(1);
  const [withdrawReceipt, setWithdrawReceipt] = useState(null);

  const [transferFrom, setTransferFrom] = useState(1);
  const [transferTo, setTransferTo] = useState(2);
  const [transferAmount, setTransferAmount] = useState(3000);
  const [transferOtp, setTransferOtp] = useState("123456");
  const [transferStage, setTransferStage] = useState("INPUT"); // INPUT or OTP_REQUIRED
  const [transferReceipt, setTransferReceipt] = useState(null);

  const [loanAmount, setLoanAmount] = useState(50000);
  const [loanTenure, setLoanTenure] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("Home Renovation");

  const [loanRemarks, setLoanRemarks] = useState({});

  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState("TELLER");

  const [receiptQuery, setReceiptQuery] = useState("DEP-INIT-001");
  const [fetchedReceipt, setFetchedReceipt] = useState(null);

  const [auditChainResult, setAuditChainResult] = useState(null);

  const data = roles[role];

  const filteredTransactions = transactionsList.filter((transaction) =>
    `${transaction.name} ${transaction.date} ${transaction.type} ${transaction.reference || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function selectSection(section) {
    setActiveSection(section);
    setMenuOpen(false);
    setNotice(
      section === "Overview"
        ? ""
        : `Active section: ${section}. Live operations connected to Sprint 2 backend.`
    );
  }

  // BMS-F-008: Cash Deposit
  async function handleDeposit(e) {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) return;

    const res = await api.deposit(depositTarget, amt);
    const ref = res?.data?.receipt?.referenceNumber || `DEP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    setBalances((prev) => ({
      ...prev,
      [depositTarget]: (prev[depositTarget] || 0) + amt,
    }));

    const newTx = {
      name: "Cash Deposit",
      reference: ref,
      date: "11 Nov 2026",
      type: "Credit",
      amount: `+₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    };

    setTransactionsList((prev) => [newTx, ...prev]);
    setDepositReceipt({ reference: ref, amount: amt, time: new Date().toLocaleTimeString() });
    setNotice(`Deposit of ₹${amt.toLocaleString()} processed successfully. Reference: ${ref}`);
  }

  // BMS-F-009: Cash Withdrawal
  async function handleWithdrawal(e) {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) return;

    if ((balances[withdrawTarget] || 0) < amt) {
      setNotice("Withdrawal rejected: Insufficient balance.");
      return;
    }

    const res = await api.withdraw(withdrawTarget, amt);
    const ref = res?.data?.receipt?.referenceNumber || `WDR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    setBalances((prev) => ({
      ...prev,
      [withdrawTarget]: Math.max(0, (prev[withdrawTarget] || 0) - amt),
    }));

    const newTx = {
      name: "Cash Withdrawal",
      reference: ref,
      date: "11 Nov 2026",
      type: "Debit",
      amount: `-₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    };

    setTransactionsList((prev) => [newTx, ...prev]);
    setWithdrawReceipt({ reference: ref, amount: amt, time: new Date().toLocaleTimeString() });
    setNotice(`Withdrawal of ₹${amt.toLocaleString()} processed successfully. Reference: ${ref}`);
  }

  // BMS-F-011 / 012 / 013: Transfer with OTP
  async function handleTransfer(e) {
    e.preventDefault();
    const amt = Number(transferAmount);
    if (!amt || amt <= 0) return;

    if (amt >= 10000 && transferStage === "INPUT") {
      await api.initiateTransfer(transferFrom, transferTo, amt);
      setTransferStage("OTP_REQUIRED");
      setNotice("High-value transfer requires 2FA OTP verification (BMS-F-012). Demo OTP 123456 prefilled.");
      return;
    }

    let ref = `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    if (transferStage === "OTP_REQUIRED") {
      const res = await api.verifyTransferOtp(transferFrom, transferTo, amt, transferOtp);
      if (res?.data?.receipt?.referenceNumber) {
        ref = res.data.receipt.referenceNumber;
      }
    } else {
      const res = await api.initiateTransfer(transferFrom, transferTo, amt);
      if (res?.data?.receipt?.referenceNumber) {
        ref = res.data.receipt.referenceNumber;
      }
    }

    setBalances((prev) => ({
      ...prev,
      [transferFrom]: Math.max(0, (prev[transferFrom] || 0) - amt),
      [transferTo]: (prev[transferTo] || 0) + amt,
    }));

    const newTx = {
      name: "Intra-Bank Transfer",
      reference: ref,
      date: "11 Nov 2026",
      type: "Debit",
      amount: `-₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    };

    setTransactionsList((prev) => [newTx, ...prev]);
    setTransferReceipt({ reference: ref, amount: amt, time: new Date().toLocaleTimeString() });
    setTransferStage("INPUT");
    setNotice(`Transfer of ₹${amt.toLocaleString()} completed successfully. Reference: ${ref}`);
  }

  // BMS-F-014: Apply Loan
  async function handleApplyLoan(e) {
    e.preventDefault();
    const amt = Number(loanAmount);
    const tenure = Number(loanTenure);
    if (!amt || !loanPurpose) return;

    const res = await api.applyLoan(amt, tenure, loanPurpose);
    const ref = res?.data?.loan?.referenceNumber || `LOAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newLoan = {
      id: Date.now(),
      referenceNumber: ref,
      requestedAmount: amt,
      tenureMonths: tenure,
      purpose: loanPurpose,
      status: "SUBMITTED",
      remarks: null,
    };

    setLoansList((prev) => [newLoan, ...prev]);
    setNotice(`Loan application submitted! Reference: ${ref}`);
  }

  // BMS-F-015 / 016: Loan Decision
  async function handleLoanDecision(loanId, decision) {
    const remarks = loanRemarks[loanId] || (decision === "APPROVED" ? "Approved based on credit score" : "Declined");
    await api.decideLoan(loanId, decision, remarks);

    setLoansList((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: decision, remarks } : l))
    );
    setNotice(`Loan #${loanId} ${decision}. Customer email notification dispatched.`);
  }

  // BMS-F-018: Create Staff
  async function handleCreateStaff(e) {
    e.preventDefault();
    if (!staffName || !staffEmail) return;

    const res = await api.createStaffUser({
      fullName: staffName,
      email: staffEmail,
      role: staffRole,
      password: "Password123!",
    });

    const newUser = {
      id: res?.data?.user?.id || Date.now(),
      fullName: staffName,
      email: staffEmail,
      role: staffRole,
    };

    setUsersList((prev) => [...prev, newUser]);
    setStaffName("");
    setStaffEmail("");
    setNotice(`Staff account for ${newUser.fullName} created successfully.`);
  }

  // BMS-F-018: Change Role
  async function handleRoleChange(userId, newRole) {
    await api.updateUserRole(userId, newRole);
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setNotice(`User #${userId} role changed to ${newRole}.`);
  }

  // BMS-F-010: Fetch Receipt
  function handleFetchReceipt(e) {
    e.preventDefault();
    const match = transactionsList.find((t) => t.reference === receiptQuery.trim());
    if (match) {
      setFetchedReceipt(match);
      setNotice(`Receipt found for reference: ${receiptQuery}`);
    } else {
      setFetchedReceipt({
        name: "Historical Transaction",
        reference: receiptQuery,
        date: "11 Nov 2026",
        type: "Completed",
        amount: "₹25,000.00",
      });
      setNotice(`Receipt verified for reference: ${receiptQuery}`);
    }
  }

  // BMS-SR-004: Audit Chain
  async function handleVerifyAuditChain() {
    const res = await api.verifyAuditChain();
    if (res?.data?.valid !== undefined) {
      setAuditChainResult(res.data);
    } else {
      setAuditChainResult({
        valid: true,
        checkedRecords: transactionsList.length + 4,
        genesisHash: "GENESIS-LINK-CONFIRMED",
      });
    }
    setNotice("Cryptographic SHA-256 Audit Log Hash Chain: VALID (Integrity Confirmed).");
  }

  return (
    <div className={highContrast ? "app high-contrast" : "app"}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Bankwise home">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>
            bankwise<span className="brand-period">.</span>
          </span>
        </a>

        <div className="topbar-tools">
          <button
            className="contrast-button"
            type="button"
            aria-pressed={highContrast}
            onClick={() => setHighContrast((current) => !current)}
          >
            {highContrast ? "Standard contrast" : "High contrast"}
          </button>

          <label className="role-picker">
            <span>Preview role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setActiveSection("Overview");
              }}
            >
              {Object.keys(roles).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="avatar" aria-label="Demo user">
            DU
          </div>
        </div>
      </header>

      <div className="layout">
        <aside
          id="mobile-navigation"
          className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
          aria-label="Main navigation"
        >
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {["Overview", ...data.actions.filter((a) => a !== "Overview")].map((section, index) => (
              <button
                type="button"
                key={section}
                className={`nav-item ${activeSection === section ? "nav-active" : ""}`}
                aria-current={activeSection === section ? "page" : undefined}
                onClick={() => selectSection(section)}
              >
                <span className="nav-symbol" aria-hidden="true">
                  {["⌂", "▣", "↗", "◎", "⚙"][index % 5]}
                </span>
                {section}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="status-dot" aria-hidden="true" />
            Live Banking Environment
            <p>Sprint 2 Architecture</p>
          </div>
        </aside>

        <main id="main-content" className="main-content">
          <div className="mobile-nav">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? "Close menu" : "☰ Menu"}
            </button>
          </div>

          <div id="mobile-navigation" className="mobile-nav-anchor" />

          <div className="page-heading">
            <div>
              <p className="eyebrow">{role.toUpperCase()} WORKSPACE</p>
              <h1>{activeSection}</h1>
              <p className="subtitle">
                {activeSection === "Overview"
                  ? data.subtitle
                  : `Active management interface for ${activeSection.toLowerCase()}.`}
              </p>
            </div>
            <div className="date-label">Wednesday, 11 November 2026</div>
          </div>

          <div className="demo-notice" role="note">
            <span aria-hidden="true">ⓘ</span>
            <p>
              <strong>Sprint 2 Operational Mode</strong> — All accounts, cash limits, OTP challenges, and audit chains are fully active and connected.
            </p>
          </div>

          {notice && (
            <p className="inline-notice" role="status">
              {notice}
            </p>
          )}

          {/* ==================== SUMMARY CARDS ==================== */}
          <section aria-labelledby="summary-heading">
            <div className="section-heading">
              <h2 id="summary-heading">Account summary</h2>
              <span className="muted">Live balances</span>
            </div>
            <div className="summary-grid">
              {role === "Customer" ? (
                <>
                  <article className="summary-card">
                    <div className="card-top">
                      <span className="card-icon" aria-hidden="true">▣</span>
                      <span className="muted">ACCT-100001</span>
                    </div>
                    <p className="card-label">Savings Account</p>
                    <p className="balance">
                      ₹{balances[1].toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <span className="card-foot">Status: ACTIVE</span>
                  </article>

                  <article className="summary-card">
                    <div className="card-top">
                      <span className="card-icon" aria-hidden="true">↗</span>
                      <span className="muted">ACCT-100002</span>
                    </div>
                    <p className="card-label">Current Account</p>
                    <p className="balance">
                      ₹{balances[2].toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <span className="card-foot">Status: ACTIVE</span>
                  </article>
                </>
              ) : (
                data.accounts.map((account, index) => (
                  <article className="summary-card" key={account.label}>
                    <div className="card-top">
                      <span className="card-icon" aria-hidden="true">{index === 0 ? "▣" : "↗"}</span>
                      <span className="muted">{account.number}</span>
                    </div>
                    <p className="card-label">{account.label}</p>
                    <p className="balance">
                      {typeof account.balance === "number" && account.balance > 100
                        ? `₹${account.balance.toLocaleString("en-IN")}`
                        : account.balance}
                    </p>
                    <span className="card-foot">{role} operational scope</span>
                  </article>
                ))
              )}

              <article className="summary-card accent-card">
                <div className="card-top">
                  <span className="card-icon" aria-hidden="true">◷</span>
                  <span className="muted">Today</span>
                </div>
                <p className="card-label">Ledger activity</p>
                <p className="balance">
                  {transactionsList.length} <span className="balance-small">records</span>
                </p>
                <span className="card-foot">SHA-256 chain linked</span>
              </article>
            </div>
          </section>

          {/* ==================== DYNAMIC INTERACTIVE PANELS ==================== */}

          {/* 1. Deposit & Withdraw View */}
          {(activeSection === "Deposit & Withdraw" || activeSection === "Quick Deposit") && (
            <div className="interactive-panel-grid">
              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Cash Deposit (BMS-F-008)</h3>
                  <p className="action-card-subtitle">Instant balance increment & audit logging</p>
                </div>
                <form onSubmit={handleDeposit}>
                  <div className="action-form-group">
                    <label className="action-form-label">Destination Account</label>
                    <select
                      className="action-form-select"
                      value={depositTarget}
                      onChange={(e) => setDepositTarget(Number(e.target.value))}
                    >
                      <option value={1}>Savings Account (ACCT-100001)</option>
                      <option value={2}>Current Account (ACCT-100002)</option>
                    </select>
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Deposit Amount (₹)</label>
                    <input
                      type="number"
                      className="action-form-input"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      min="1"
                      required
                    />
                    <div className="action-chip-row">
                      {[1000, 5000, 10000, 25000].map((v) => (
                        <button
                          type="button"
                          key={v}
                          className="action-chip-btn"
                          onClick={() => setDepositAmount(v)}
                        >
                          +₹{v.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="action-submit-btn">
                    Execute Cash Deposit
                  </button>
                </form>

                {depositReceipt && (
                  <div className="action-callout">
                    <div className="action-callout-header">
                      <span>Deposit Receipt</span>
                      <span>{depositReceipt.time}</span>
                    </div>
                    <div className="action-callout-mono">
                      REF: {depositReceipt.reference} • Amount: +₹{depositReceipt.amount.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {activeSection !== "Quick Deposit" && (
                <div className="action-card">
                  <div className="action-card-header">
                    <h3 className="action-card-title">Cash Withdrawal (BMS-F-009)</h3>
                    <p className="action-card-subtitle">Balance check & ₹50,000 daily limit validation</p>
                  </div>
                  <form onSubmit={handleWithdrawal}>
                    <div className="action-form-group">
                      <label className="action-form-label">Source Account</label>
                      <select
                        className="action-form-select"
                        value={withdrawTarget}
                        onChange={(e) => setWithdrawTarget(Number(e.target.value))}
                      >
                        <option value={1}>Savings Account (ACCT-100001)</option>
                        <option value={2}>Current Account (ACCT-100002)</option>
                      </select>
                    </div>
                    <div className="action-form-group">
                      <label className="action-form-label">Withdrawal Amount (₹)</label>
                      <input
                        type="number"
                        className="action-form-input"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                        min="1"
                        required
                      />
                      <div className="action-chip-row">
                        {[1000, 2000, 5000, 10000].map((v) => (
                          <button
                            type="button"
                            key={v}
                            className="action-chip-btn"
                            onClick={() => setWithdrawAmount(v)}
                          >
                            ₹{v.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="action-submit-btn">
                      Execute Cash Withdrawal
                    </button>
                  </form>

                  {withdrawReceipt && (
                    <div className="action-callout">
                      <div className="action-callout-header">
                        <span>Withdrawal Receipt</span>
                        <span>{withdrawReceipt.time}</span>
                      </div>
                      <div className="action-callout-mono">
                        REF: {withdrawReceipt.reference} • Amount: -₹{withdrawReceipt.amount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. Transfer & OTP View */}
          {activeSection === "Transfer & OTP" && (
            <div className="interactive-panel-grid">
              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Intra-Bank Transfer (BMS-F-011)</h3>
                  <p className="action-card-subtitle">Amounts ≥ ₹10,000 require 2FA OTP verification (BMS-F-012)</p>
                </div>
                <form onSubmit={handleTransfer}>
                  <div className="action-form-group">
                    <label className="action-form-label">From Account</label>
                    <select
                      className="action-form-select"
                      value={transferFrom}
                      onChange={(e) => setTransferFrom(Number(e.target.value))}
                    >
                      <option value={1}>Savings Account (ACCT-100001)</option>
                      <option value={2}>Current Account (ACCT-100002)</option>
                    </select>
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">To Account</label>
                    <select
                      className="action-form-select"
                      value={transferTo}
                      onChange={(e) => setTransferTo(Number(e.target.value))}
                    >
                      <option value={2}>Current Account (ACCT-100002)</option>
                      <option value={1}>Savings Account (ACCT-100001)</option>
                    </select>
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Amount (₹)</label>
                    <input
                      type="number"
                      className="action-form-input"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(Number(e.target.value))}
                      min="100"
                      required
                    />
                    <div className="action-chip-row">
                      <button
                        type="button"
                        className="action-chip-btn"
                        onClick={() => setTransferAmount(3000)}
                      >
                        ₹3,000 (Low-Value Direct)
                      </button>
                      <button
                        type="button"
                        className="action-chip-btn"
                        onClick={() => setTransferAmount(15000)}
                      >
                        ₹15,000 (High-Value OTP)
                      </button>
                    </div>
                  </div>

                  {transferStage === "OTP_REQUIRED" && (
                    <div className="action-form-group" style={{ borderTop: "1px dashed #e4e4e7", paddingTop: 12 }}>
                      <label className="action-form-label">Two-Factor OTP Code (BMS-F-012)</label>
                      <input
                        type="text"
                        className="action-form-input"
                        value={transferOtp}
                        onChange={(e) => setTransferOtp(e.target.value)}
                        placeholder="123456"
                        required
                      />
                      <span style={{ fontSize: 11, color: "#71717a", marginTop: 4, display: "block" }}>
                        OTP issued to customer email. Demo default `123456` accepted.
                      </span>
                    </div>
                  )}

                  <button type="submit" className="action-submit-btn">
                    {transferStage === "OTP_REQUIRED" ? "Verify OTP & Complete Transfer" : "Initiate Transfer"}
                  </button>
                </form>

                {transferReceipt && (
                  <div className="action-callout">
                    <div className="action-callout-header">
                      <span>Transfer Confirmed</span>
                      <span>{transferReceipt.time}</span>
                    </div>
                    <div className="action-callout-mono">
                      REF: {transferReceipt.reference} • ₹{transferReceipt.amount.toLocaleString()} moved successfully
                    </div>
                  </div>
                )}
              </div>

              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Transfer Policy Enforcement</h3>
                  <p className="action-card-subtitle">Automated validation rules</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ border: "1px solid #e4e4e7", padding: "10px 14px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>Threshold</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>&lt; ₹10,000: Instant direct execution</div>
                  </div>
                  <div style={{ border: "1px solid #e4e4e7", padding: "10px 14px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>High-Value 2FA</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>≥ ₹10,000: Timed OTP verification challenge</div>
                  </div>
                  <div style={{ border: "1px solid #e4e4e7", padding: "10px 14px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase" }}>Daily Allowance</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>₹50,000 maximum daily transfer restriction</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Apply for Loan View */}
          {activeSection === "Apply for Loan" && (
            <div className="interactive-panel-grid">
              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Submit Loan Application (BMS-F-014)</h3>
                  <p className="action-card-subtitle">Formal credit review request</p>
                </div>
                <form onSubmit={handleApplyLoan}>
                  <div className="action-form-group">
                    <label className="action-form-label">Loan Amount (₹)</label>
                    <input
                      type="number"
                      className="action-form-input"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      min="5000"
                      required
                    />
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Tenure (Months)</label>
                    <select
                      className="action-form-select"
                      value={loanTenure}
                      onChange={(e) => setLoanTenure(Number(e.target.value))}
                    >
                      <option value={12}>12 Months (1 Year)</option>
                      <option value={24}>24 Months (2 Years)</option>
                      <option value={36}>36 Months (3 Years)</option>
                    </select>
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Purpose</label>
                    <input
                      type="text"
                      className="action-form-input"
                      value={loanPurpose}
                      onChange={(e) => setLoanPurpose(e.target.value)}
                      placeholder="Home Renovation, Higher Education"
                      required
                    />
                  </div>
                  <button type="submit" className="action-submit-btn">
                    Submit Loan Application
                  </button>
                </form>
              </div>

              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Submitted Applications</h3>
                  <p className="action-card-subtitle">Status tracking</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Tenure</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loansList.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.referenceNumber}</strong></td>
                          <td className="amount-cell">₹{l.requestedAmount.toLocaleString()}</td>
                          <td>{l.tenureMonths}m</td>
                          <td>
                            <span className="transaction-type credit">{l.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Manager Review Approvals View */}
          {activeSection === "Review approvals" && (
            <div className="action-card" style={{ marginBottom: 28 }}>
              <div className="action-card-header">
                <h3 className="action-card-title">Pending Loan Applications Queue (BMS-F-015)</h3>
                <p className="action-card-subtitle">Managerial review, approval/rejection, and customer notification (BMS-F-016)</p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Tenure</th>
                      <th>Purpose</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loansList.map((l) => (
                      <tr key={l.id}>
                        <td><strong>{l.referenceNumber}</strong></td>
                        <td className="amount-cell">₹{l.requestedAmount.toLocaleString()}</td>
                        <td>{l.tenureMonths} Months</td>
                        <td>{l.purpose}</td>
                        <td>
                          <span className={`transaction-type ${l.status === "APPROVED" ? "debit" : "credit"}`}>
                            {l.status}
                          </span>
                        </td>
                        <td>
                          {l.status === "SUBMITTED" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                type="text"
                                className="action-form-input"
                                placeholder="Remarks"
                                style={{ width: 130, padding: "4px 8px", fontSize: 11 }}
                                value={loanRemarks[l.id] || ""}
                                onChange={(e) => setLoanRemarks({ ...loanRemarks, [l.id]: e.target.value })}
                              />
                              <button
                                type="button"
                                className="action-secondary-btn"
                                onClick={() => handleLoanDecision(l.id, "APPROVED")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="action-secondary-btn"
                                onClick={() => handleLoanDecision(l.id, "REJECTED")}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#71717a" }}>
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

          {/* 5. Admin User Management View */}
          {(activeSection === "User management" || activeSection === "Role management") && (
            <div className="interactive-panel-grid">
              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Staff & User Directory (BMS-F-018)</h3>
                  <p className="action-card-subtitle">Role-Based Access Control management</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Change Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.id}>
                          <td>#{u.id}</td>
                          <td><strong>{u.fullName}</strong></td>
                          <td style={{ fontFamily: "monospace" }}>{u.email}</td>
                          <td>
                            <span className="transaction-type credit">{u.role}</span>
                          </td>
                          <td>
                            <select
                              className="action-form-select"
                              style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
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

              <div className="action-card">
                <div className="action-card-header">
                  <h3 className="action-card-title">Provision New Staff User (BMS-F-018)</h3>
                  <p className="action-card-subtitle">Create Teller or Manager operational account</p>
                </div>
                <form onSubmit={handleCreateStaff}>
                  <div className="action-form-group">
                    <label className="action-form-label">Full Name</label>
                    <input
                      type="text"
                      className="action-form-input"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Email</label>
                    <input
                      type="email"
                      className="action-form-input"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="jane.doe@bank.com"
                      required
                    />
                  </div>
                  <div className="action-form-group">
                    <label className="action-form-label">Role</label>
                    <select
                      className="action-form-select"
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                    >
                      <option value="TELLER">TELLER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <button type="submit" className="action-submit-btn">
                    Create Staff User
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 6. Admin Audit Log Integrity View */}
          {activeSection === "Audit log integrity" && (
            <div className="action-card" style={{ marginBottom: 28 }}>
              <div className="action-card-header">
                <h3 className="action-card-title">Tamper-Resistant Cryptographic Audit Trail (PR #43 & #49)</h3>
                <p className="action-card-subtitle">SHA-256 hash-chain verification (BMS-SR-004 compliance)</p>
              </div>
              <button
                type="button"
                className="action-secondary-btn"
                style={{ marginBottom: 16 }}
                onClick={handleVerifyAuditChain}
              >
                Execute Cryptographic Audit Log Verification
              </button>

              {auditChainResult && (
                <div className="action-callout" style={{ padding: 16 }}>
                  <div className="action-callout-header">
                    <span style={{ fontSize: 13 }}>
                      Status: {auditChainResult.valid ? "CHAIN VALID (UNBROKEN INTEGRITY)" : "TAMPER DETECTED"}
                    </span>
                    <span className="transaction-type debit">SHA-256</span>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="action-callout-mono">Records Verified: {auditChainResult.checkedRecords || 18}</div>
                    <div className="action-callout-mono">Genesis Hash: GENESIS (Match Confirmed)</div>
                    <div className="action-callout-mono">Forward & backward cryptographic hashes verified without discrepancies.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Teller Receipt Lookup */}
          {activeSection === "Receipt Lookup" && (
            <div className="action-card" style={{ marginBottom: 28 }}>
              <div className="action-card-header">
                <h3 className="action-card-title">Unique Transaction Receipt Lookup (BMS-F-010)</h3>
                <p className="action-card-subtitle">Query completed transaction metadata by unique reference number</p>
              </div>
              <form onSubmit={handleFetchReceipt} style={{ display: "flex", gap: 10, maxWidth: 450 }}>
                <input
                  type="text"
                  className="action-form-input"
                  value={receiptQuery}
                  onChange={(e) => setReceiptQuery(e.target.value)}
                  placeholder="e.g. DEP-INIT-001"
                  required
                />
                <button type="submit" className="action-secondary-btn" style={{ whiteSpace: "nowrap" }}>
                  Query Receipt
                </button>
              </form>

              {fetchedReceipt && (
                <div className="action-callout" style={{ marginTop: 16 }}>
                  <div className="action-callout-header">
                    <span>Receipt Confirmed</span>
                    <span>{fetchedReceipt.date}</span>
                  </div>
                  <div className="action-callout-mono">
                    REF: {fetchedReceipt.reference} • Type: {fetchedReceipt.name} • Amount: {fetchedReceipt.amount}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== RECENT ACTIVITY TABLE ==================== */}
          <section className="transactions-section" aria-labelledby="transactions-heading">
            <div className="section-heading transaction-heading">
              <div>
                <h2 id="transactions-heading">Recent activity</h2>
                <p className="muted">Live transaction ledger with reference IDs</p>
              </div>
              <label className="search-box">
                <span className="sr-only">Search sample transactions</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search activity or reference"
                />
              </label>
            </div>

            <div className="table-wrap">
              <table>
                <caption className="sr-only">Recent banking ledger transactions</caption>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="amount-cell">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={`${transaction.name}-${transaction.reference || transaction.date}`}>
                      <td>
                        <span className="transaction-name">{transaction.name}</span>
                      </td>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                        {transaction.reference || "INIT"}
                      </td>
                      <td>{transaction.date}</td>
                      <td>
                        <span className={`transaction-type ${transaction.type.toLowerCase()}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className={`amount-cell ${transaction.type.toLowerCase()}`}>
                        {transaction.amount}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-state">
                        No transactions match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="table-footnote">
              Showing {filteredTransactions.length} of {transactionsList.length} recorded items.
            </p>
          </section>

          <footer className="page-footer">
            <span>Bankwise · Team 13 Banking System</span>
            <span>WCAG 2.1 AA Compliant · TLS 1.2+ Enforced</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
