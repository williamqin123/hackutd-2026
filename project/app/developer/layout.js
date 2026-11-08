import Link from 'next/link';
import DeveloperAccess from '../../components/DeveloperAccess.jsx';

export default function DeveloperLayout({ children }) {
  return <main>
    <nav><Link href="/developer/simulations">Developer simulations</Link></nav>
    <DeveloperAccess />
    {children}
  </main>;
}
