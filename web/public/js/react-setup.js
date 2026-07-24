// No build step: React, ReactDOM, and htm (JSX-like template tags without a compiler) are all
// loaded straight from the esm.sh CDN as native ES modules. This is what "no npm registry
// access" forces here — see HANDOFF.md for what production tooling should replace it with.
import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

export const { useState, useEffect, useRef } = React;
export const html = htm.bind(React.createElement);
export { createRoot };
export default React;
