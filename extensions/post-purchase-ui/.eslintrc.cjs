/**
 * Post-purchase extensions are bundled separately by the Shopify CLI using the
 * classic JSX runtime (React.createElement), so `React` must be imported and
 * stay in scope — unlike the React Router app, which uses the automatic runtime.
 * Their components render through remote-ui rather than the DOM, so React
 * prop-types validation doesn't apply here.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  env: {
    browser: true,
  },
  rules: {
    "react/react-in-jsx-scope": "error",
    "react/jsx-uses-react": "error",
    "react/prop-types": "off",
  },
};
