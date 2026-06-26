import { privacyHTML } from './privacyContent';

export default function PrivacyPolicy() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#0070C0', fontWeight: 900, fontSize: '20px', letterSpacing: '2px' }}>
            👑 BRO-BETS
          </a>
        </div>
        <div dangerouslySetInnerHTML={{ __html: privacyHTML }} />
      </div>
    </div>
  );
}
