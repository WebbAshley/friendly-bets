import { termsHTML } from './termsContent';

export default function Terms() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <a href="/">
            <img src="/logo.png" alt="Bro-Bets" height={40} />
          </a>
        </div>
        <div dangerouslySetInnerHTML={{ __html: termsHTML }} />
      </div>
    </div>
  );
}
