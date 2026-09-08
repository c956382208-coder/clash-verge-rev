/**
 * The design shell owns the home screen. Keeping a routed component here
 * preserves the upstream route table and makes the home route safe to preload;
 * Layout intentionally does not render Outlet for `/` so no second header or
 * sidebar can leak around the design.
 */
const HomePage = () => null

export default HomePage
