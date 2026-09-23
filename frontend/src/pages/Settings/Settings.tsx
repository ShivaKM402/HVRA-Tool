/**
 * Settings page stub
 */
export default function Settings() {
  return (
    <div className="card">
      <div className="card-header"><h2 className="card-title">Settings</h2></div>
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-state-icon">⚙️</div>
          <div className="empty-state-title">Settings</div>
          <div className="empty-state-description">
            System configuration, thresholds, and user management.
          </div>
        </div>
      </div>
    </div>
  );
}
