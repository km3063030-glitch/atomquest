// src/pages/manager/TeamGoals.js
import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import api from '../../utils/api';
import { Link } from 'react-router-dom';

export default function TeamGoals() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/goals/team')
      .then(res => setTeam(res.data))
      .catch(err => console.error(err))
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
                {team.map(item => (
                  <tr key={item.employee.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.employee.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.employee.email}</div>
                    </td>
                    <td>{item.cycle?.name || 'Current'}</td>
                    <td>
                      <span className={`badge badge-${item.sheet?.status || 'not_started'}`}>
                        {item.sheet?.status?.replace('_', ' ') || 'Not Started'}
                      </span>
                    </td>
                    <td>{item.sheet?.total_weightage || 0}%</td>
                    <td>
                      {item.sheet ? (
                        <Link to={`/manager/review/${item.sheet.id}`} className="btn btn-secondary btn-sm">
                          View Sheet
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Sheet</span>
                      )}
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
