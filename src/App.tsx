import { Routes, Route } from "react-router-dom";
import Home from "./home/pages/home";
import Layout from "./global/layout/layout";
import VirtualizationProcessList from "./processVirtualization/pages/virtualizationProcessList";
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/virtualization-processes"
          element={<VirtualizationProcessList />}
        />
      </Route>
    </Routes>
  );
}

export default App;
