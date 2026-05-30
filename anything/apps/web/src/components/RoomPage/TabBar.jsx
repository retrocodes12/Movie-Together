export function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}
    >
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          style={{
            flex: 1,
            padding: "11px 4px",
            fontSize: 11,
            fontWeight: 600,
            color: activeTab === key ? "#F1F5F9" : "#475569",
            borderBottom:
              activeTab === key ? "2px solid #6366F1" : "2px solid transparent",
            background: "none",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
