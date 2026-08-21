import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../context/AuthContext';
import { BRAND_NAME } from '../design-system/brand';
import Wordmark from '../design-system/Wordmark';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

/**
 * Tela de acesso.
 *
 * A anterior abria com um cadeado genérico centralizado sobre um azul escolhido
 * à mão (`#001a33`, que não existia em lugar nenhum do produto) — a primeira
 * tela do sistema não dizia de quem era, e o único símbolo era o de "trancado".
 * Agora ela abre com a assinatura institucional e diz o que há do outro lado
 * antes de pedir a senha.
 */
export default function LoginPage() {
  const { login, provider, refresh, error: authError } = useAuth();
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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Painel institucional. No celular ele vira uma faixa curta no topo:
          a tela pequena precisa do formulário acima da dobra. */}
      <Box
        sx={{
          bgcolor: T.surface.inverted,
          color: T.ink.onInverted,
          // `0 0` em vez de `1 1`: o painel institucional tem largura fixa e o
          // formulário fica com o resto. Com os dois flexíveis, o texto longo
          // da esquerda ganhava a disputa e espremia o formulário.
          flex: { md: '0 0 48%' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 8 },
        }}
      >
        <Wordmark tone="inverted" size="lg" />
        <Typography
          sx={{
            mt: { xs: 2.5, md: 4 },
            maxWidth: 460,
            fontFamily: T.fontFamily.display,
            fontSize: { xs: '1.5rem', md: '2.35rem' },
            fontWeight: 800,
            letterSpacing: '-.03em',
            lineHeight: 1.1,
          }}
        >
          {BRAND_NAME.tagline}
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: 440, color: T.ink.onInvertedMuted, display: { xs: 'none', md: 'block' } }}>
          Encontre pessoas e instituições, pesquise referências e acompanhe novidades da educação profissional.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 5 },
          py: { xs: 5, md: 8 },
          bgcolor: T.surface.canvas,
        }}
      >
        <Card component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 } }}>
          <Typography variant="h3" sx={{ color: T.ink.strong }}>Entrar</Typography>
          <Typography variant="body2" sx={{ mt: .75, mb: 3, color: T.ink.muted }}>
            Entre para acessar as ferramentas do {BRAND_NAME.product}.
          </Typography>

          {provider === 'entra' ? (
            <Stack gap={2}>
              <Alert severity="info">
                O acesso corporativo é gerenciado pelo ambiente do {BRAND_NAME.institution}. Abra esta
                aplicação pelo Azure Easy Auth ou pela integração corporativa configurada pelo TI.
              </Alert>
              <Button type="button" fullWidth size="large" variant="contained" onClick={refresh}>
                Verificar autenticação corporativa
              </Button>
            </Stack>
          ) : (
            <Stack gap={2}>
              {(error || authError) && <Alert severity="error">{error || authError}</Alert>}
              <TextField
                fullWidth
                label="Usuário"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
              />
              <TextField
                fullWidth
                label="Senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <Button type="submit" fullWidth size="large" variant="contained" disabled={busy || !username || !password}>
                {busy ? 'Entrando…' : 'Entrar'}
              </Button>
            </Stack>
          )}

          {/* Quem não consegue entrar precisava de uma saída: "Usuário ou senha
              inválidos" sem dizer a quem pedir acesso é um beco. O acesso é
              corporativo, então a resposta cabe em uma linha. */}
          <Typography variant="caption" sx={{ display: 'block', mt: 3, color: T.ink.subtle }}>
            O acesso é liberado pela equipe de TI do {BRAND_NAME.institution}. Se você não consegue entrar
            ou esqueceu a senha, procure quem administra a ferramenta na sua área.
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: T.ink.subtle }}>
            Suas respostas são usadas apenas durante esta sessão.
          </Typography>
        </Card>
      </Box>
    </Box>
  );
}
