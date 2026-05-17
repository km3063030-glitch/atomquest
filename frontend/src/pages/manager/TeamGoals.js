// src/pages/manager/TeamGoals.js
import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import api from '../../utils/api';
import { Link } from 'react-router-dom';

export default function TeamGoals() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/goals/team-sheets')
      .then(res => setTeam(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Team Goals</h1>
          <p>View goal sheets for your direct reports.</p>
        </div>
      </div>

      <div className="card">
        {team.length === 0 ? (
          <div className="empty-state">
            <Users size={40} />
            <h3>No team members found</h3>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Weightage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {team.map(member => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{member.employee_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.employee_email}</div>
                    </td>
                    <td>{member.cycle_id || 'Current'}</td>
                    <td>
                      <span className={`badge badge-${member.status || 'not_started'}`}>
                        {member.status?.replace('_', ' ') || 'Not Started'}
                      </span>
                    </td>
                    <td>{member.total_weightage}%</td>
                    <td>
                      <Link to={`/manager/review/${member.id}`} className="btn btn-secondary btn-sm">
                        View Sheet
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
