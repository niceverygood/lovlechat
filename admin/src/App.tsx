import React from 'react'
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fa', padding: 0 }}>
      <header style={{ background: '#222', color: '#fff', padding: '24px 0', textAlign: 'center', fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>
        LovleChat Admin
      </header>
      <main style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="#" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 36, minWidth: 220, minHeight: 120, textDecoration: 'none', color: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 600, fontSize: 22 }}>
            사용자 관리
            <span style={{ fontSize: 15, color: '#888', marginTop: 10 }}>User</span>
          </a>
          <a href="#" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 36, minWidth: 220, minHeight: 120, textDecoration: 'none', color: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 600, fontSize: 22 }}>
            멀티프로필 관리
            <span style={{ fontSize: 15, color: '#888', marginTop: 10 }}>Persona</span>
          </a>
          <a href="#" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 36, minWidth: 220, minHeight: 120, textDecoration: 'none', color: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 600, fontSize: 22 }}>
            캐릭터 관리
            <span style={{ fontSize: 15, color: '#888', marginTop: 10 }}>Character</span>
          </a>
          <a href="#" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 36, minWidth: 220, minHeight: 120, textDecoration: 'none', color: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 600, fontSize: 22 }}>
            채팅 데이터
            <span style={{ fontSize: 15, color: '#888', marginTop: 10 }}>Chat</span>
          </a>
        </div>
      </main>
    </div>
  )
}

export default App
