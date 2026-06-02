export const metadata = {
  title: 'Trains — the universal train routing tool',
  description: 'Is it possible by rail? How many connections?',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0b1020', color: '#e7ecf5' }}>
        {children}
      </body>
    </html>
  );
}
