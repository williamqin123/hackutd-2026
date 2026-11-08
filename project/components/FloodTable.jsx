import Papa from 'papaparse';

function downloadCsv(records) {
  const url = URL.createObjectURL(new Blob([Papa.unparse(records)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'floods.csv';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FloodTable({ records }) {
  if (!records.length) return <p>No flood observations found.</p>;
  return <><button onClick={() => downloadCsv(records)}>Download CSV</button><div className="table-scroll"><table>
    <caption>Historical flood observations ({records.length})</caption>
    <thead><tr>{['ID', 'Event', 'Waterbody', 'Latitude', 'Longitude', 'Observed', 'Height above ground (ft)'].map(label => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{records.map(row => <tr key={row.id}>
      <td>{row.id}</td><td>{row.eventName}</td><td>{row.waterbody || '—'}</td>
      <td>{row.latitude.toFixed(5)}</td><td>{row.longitude.toFixed(5)}</td>
      <td>{row.observedAt || 'Unknown'}</td><td>{row.heightAboveGroundFt || 'Unknown'}</td>
    </tr>)}</tbody>
  </table></div></>;
}
