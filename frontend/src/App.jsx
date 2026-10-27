
import { useState } from "react";
import "./App.css";

const roles = {
  Customer: {
    subtitle: "Your finances, all in one place.",
    accounts: [
      { label: "Savings Account", number: "•••• 2841", balance: "₹48,250.00" },
      { label: "Current Account", number: "•••• 6192", balance: "₹12,800.00" },
    ],
    actions: ["View accounts", "Transaction history", "Profile settings"],
  },
  Teller: {
    subtitle: "Customer service and branch operations.",
    accounts: [
      { label: "Today's transactions", number: "Branch overview", balance: "128" },
      { label: "Pending requests", number: "Awaiting review", balance: "12" },
    ],
    actions: ["Customer lookup", "Transaction review", "Account services"],
  },
  Manager: {
    subtitle: "Monitor branch activity and performance.",
    accounts: [
      { label: "Branch transactions", number: "Today's activity", balance: "₹8.42L" },
      { label: "Pending approvals", number: "Requires review", balance: "7" },
    ],
    actions: ["Branch overview", "Review approvals", "View reports"],
  },
  Admin: {
    subtitle: "Manage system operations and access.",
    accounts: [
      { label: "Registered users", number: "Demo overview", balance: "1,248" },
      { label: "Access reviews", number: "Pending review", balance: "4" },
    ],
    actions: ["User management", "Role management", "System overview"],
  },
};

const transactions = [
  { name: "Grocery Store", date: "26 Oct 2026", type: "Debit", amount: "-₹1,250.00" },
  { name: "Salary Credit", date: "25 Oct 2026", type: "Credit", amount: "+₹35,000.00" },
  { name: "Electricity Bill", date: "24 Oct 2026", type: "Debit", amount: "-₹1,840.00" },
  { name: "Online Transfer", date: "23 Oct 2026", type: "Credit", amount: "+₹5,000.00" },
];

function App() {
  const [role, setRole] = useState("Customer");
  const [highContrast, setHighContrast] = useState(false);
  const [activeSection, setActiveSection] = useState("Overview");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const data = roles[role];
  const filteredTransactions = transactions.filter((transaction) =>
    `${transaction.name} ${transaction.date} ${transaction.type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function selectSection(section) {
    setActiveSection(section);
    setMenuOpen(false);
    setNotice(
      section === "Overview"
        ? ""
        : `${section} is a demonstration view. No banking data or transactions are changed.`
    );
  }

  return (
    <div className={highContrast ? "app high-contrast" : "app"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Bankwise home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>bankwise<span className="brand-period">.</span></span>
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
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {Object.keys(roles).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="avatar" aria-label="Demo user">DU</div>
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
            {["Overview", ...data.actions].map((section, index) => (
              <button
                type="button"
                key={section}
                className={`nav-item ${activeSection === section ? "nav-active" : ""}`}
                aria-current={activeSection === section ? "page" : undefined}
                onClick={() => selectSection(section)}
              >
                <span className="nav-symbol" aria-hidden="true">
                  {["⌂", "▤", "↗", "⚙"][index % 4]}
                </span>
                {section}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="status-dot" aria-hidden="true" />
            Demo environment
            <p>Sample data only</p>
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
                {activeSection === "Overview" ? data.subtitle : `Welcome to ${activeSection.toLowerCase()}.`}
              </p>
            </div>
            <div className="date-label">Tuesday, 27 October 2026</div>
          </div>

          <div className="demo-notice" role="note">
            <span aria-hidden="true">ⓘ</span>
            <p><strong>Prototype preview</strong> — all balances and activity below are illustrative, not live banking records.</p>
          </div>

          {notice && (
            <p className="inline-notice" role="status">{notice}</p>
          )}

          <section aria-labelledby="summary-heading">
            <div className="section-heading">
              <h2 id="summary-heading">Your summary</h2>
              <span className="muted">Sample figures</span>
            </div>
            <div className="summary-grid">
              {data.accounts.map((account, index) => (
                <article className="summary-card" key={account.label}>
                  <div className="card-top">
                    <span className="card-icon" aria-hidden="true">{index === 0 ? "▣" : "↗"}</span>
                    <span className="muted">{account.number}</span>
                  </div>
                  <p className="card-label">{account.label}</p>
                  <p className="balance">{account.balance}</p>
                  <span className="card-foot">{role} overview</span>
                </article>
              ))}
              <article className="summary-card accent-card">
                <div className="card-top">
                  <span className="card-icon" aria-hidden="true">◷</span>
                  <span className="muted">This month</span>
                </div>
                <p className="card-label">Recent activity</p>
                <p className="balance">{transactions.length} <span className="balance-small">items</span></p>
                <span className="card-foot">Illustrative activity</span>
              </article>
            </div>
          </section>

          <section className="transactions-section" aria-labelledby="transactions-heading">
            <div className="section-heading transaction-heading">
              <div>
                <h2 id="transactions-heading">Recent activity</h2>
                <p className="muted">Example transactions for interface preview</p>
              </div>
              <label className="search-box">
                <span className="sr-only">Search sample transactions</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search activity"
                />
              </label>
            </div>

            <div className="table-wrap">
              <table>
                <caption className="sr-only">Illustrative recent transactions</caption>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="amount-cell">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={`${transaction.name}-${transaction.date}`}>
                      <td>
                        <span className="transaction-name">{transaction.name}</span>
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
                      <td colSpan="4" className="empty-state">No sample transactions match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="table-footnote">Showing {filteredTransactions.length} of {transactions.length} sample items.</p>
          </section>

          <footer className="page-footer">
            <span>Bankwise · Student project prototype</span>
            <span>Accessibility and responsive UI preview</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
