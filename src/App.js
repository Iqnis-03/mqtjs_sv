import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import MqtDisplay from './components/MqtDisplay'
import MqtSetting from './components/MqtSetting'

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<MqtSetting />} />         {/* default page is settings */}
      <Route path="/display" element={<MqtDisplay />} />  {/* timer display page */}
    </Routes>
  </Router>
)

export default App