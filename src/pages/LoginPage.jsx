import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (loginError) {
      setError(loginError.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#001a33', p: 2 }}>
      <Paper component="form" onSubmit={handleSubmit} elevation={8} sx={{ p: { xs: 3, sm: 5 }, maxWidth: 430, width: '100%', borderRadius: 3 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', mb: 2 }}>
          <LockOutlinedIcon sx={{ fontSize: 44, color: 'primary.main' }} />
        </Box>
        <Typography variant="h5" fontWeight={800} textAlign="center">SENAI-SP Parceiros</Typography>
        <Typography color="text.secondary" textAlign="center" sx={{ mt: 1, mb: 3 }}>
          Acesso restrito à ferramenta de seleção e pesquisa.
        </Typography>
        {(error || authError) && <Alert severity="error" sx={{ mb: 2 }}>{error || authError}</Alert>}
        <TextField fullWidth label="Usuário" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus sx={{ mb: 2 }} />
        <TextField fullWidth label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" sx={{ mb: 2.5 }} />
        <Button type="submit" fullWidth size="large" variant="contained" disabled={busy || !username || !password}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 2 }}>
          As avaliações não ficam salvas na ferramenta.
        </Typography>
      </Paper>
    </Box>
  );
}
