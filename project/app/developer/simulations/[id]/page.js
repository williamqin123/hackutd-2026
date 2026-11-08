import SimulationStatus from '../../../../components/SimulationStatus.jsx';

export default async function SimulationPage({ params }) {
  const { id } = await params;
  return <><h1>Simulation results</h1><p>ID: {id}</p><SimulationStatus id={id} /></>;
}
