import Link from 'next/link';
import manifest from '../../extension/manifest.json';
import release from '../../extension/release-metadata.json';

const extensionVersion = `${manifest.version}-${release.channel}.${release.iteration}`;
const downloadPath = `/downloads/plant-extension-v${extensionVersion}.zip`;

export default function HomePage() {
  return (
    <div className="landing-stack">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">Community garden closed beta</p>
        <h1 id="home-title">Grow privately. Share when your plant is ready.</h1>
        <p>The community garden is the public home for mature plants shared by beta gardeners.</p>
        <Link className="garden-link" href="/garden">Visit the community garden</Link>
      </section>

      <section className="panel extension-download" aria-labelledby="extension-title">
        <p className="eyebrow">Chrome extension · v{extensionVersion}</p>
        <h2 id="extension-title">Grow your own plant</h2>
        <p>
          Your plant lives and grows in the browser extension. Real-world weather and manual
          watering affect it; once it reaches maturity, you can add a snapshot to the community garden.
        </p>
        <a className="download-link" href={downloadPath} download>Download Chrome Extension — Beta</a>
        <h3>Install in Chrome</h3>
        <ol>
          <li>Download and extract the ZIP to a folder.</li>
          <li>Open <code>chrome://extensions</code> and enable <strong>Developer mode</strong>.</li>
          <li>Choose <strong>Load unpacked</strong> and select the extracted folder.</li>
          <li>Pin the extension if desired, then open it and complete setup.</li>
        </ol>
        <p className="beta-note"><strong>Closed beta:</strong> You may encounter bugs. Please do not redistribute this early test build publicly.</p>
      </section>
    </div>
  );
}
