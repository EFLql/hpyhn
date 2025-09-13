import '../styles/globals.css';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* The title and favicon are typically here. Page-specific head elements should be in individual pages. */}
        {/* <title>Hacker News AI Analyst</title> */}
        {/* <link rel="icon" href="/favicon.ico" /> */}
      </Head>

      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
