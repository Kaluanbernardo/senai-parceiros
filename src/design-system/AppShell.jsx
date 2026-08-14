import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import { getBreadcrumbs, isActive } from '../app/navigation';
import { DESIGN_TOKENS as T } from './tokens';
import Wordmark from './Wordmark';

/**
 * Casca da aplicação.
 *
 * O que mudou e por quê:
 *
 * - **Um andar em vez de dois.** O cabeçalho anterior empilhava uma barra com o
 *   nome e uma faixa de abas que rolava na horizontal, somando 120px de cromo
 *   antes de qualquer conteúdo. No celular a faixa exigia rolar de lado para
 *   descobrir as ferramentas disponíveis — navegação escondida atrás de um
 *   gesto que nada anuncia. Agora: uma linha só, com as ferramentas visíveis no
 *   desktop e uma gaveta explícita no celular.
 * - **Trilha.** Quem chega por link direto em `/catalogo/especialistas` passa a
 *   ver onde está e a ter um caminho de volta de um clique.
 * - **Atalho para o conteúdo.** O primeiro `Tab` da página pula o cabeçalho
 *   inteiro em vez de percorrer sete botões de navegação a cada tela.
 */

export default function AppShell({ children, user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const trail = getBreadcrumbs(location.pathname);
  const isAdmin = user?.role === 'admin';
  const navTools = getNavTools(user?.role);

  const go = (route) => {
    setDrawerOpen(false);
    navigate(route);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: T.surface.canvas }}>
      <SkipLink />

      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: T.surface.inverted,
          // Uma linha de contorno em vez de sombra: o cabeçalho fica preso ao
          // topo o tempo todo, e uma sombra permanente vira sujeira.
          borderBottom: `1px solid ${T.border.onInverted}`,
          backgroundImage: 'none',
        }}
      >
        <Toolbar sx={{ minHeight: `${T.layout.headerHeight}px !important`, gap: 1, px: { xs: 1.5, md: 3 } }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Abrir menu de navegação"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box
            component={RouterLink}
            to="/"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', mr: { md: 2 }, borderRadius: `${T.radius.xs}px` }}
          >
            <Wordmark tone="inverted" />
          </Box>

          {/* Navegação principal no desktop. `nav` com nome acessível para o
              leitor de tela distinguir esta lista da gaveta e da trilha. */}
          <Stack
            component="nav"
            aria-label="Ferramentas"
            direction="row"
            sx={{ display: { xs: 'none', md: 'flex' }, gap: .25, flex: 1, minWidth: 0 }}
          >
            {navTools.map((tool) => {
              const active = isActive(location.pathname, tool.route, tool.matchPrefix);
              const tone = T.tools[tool.themeKey];
              return (
                <Button
                  key={tool.route}
                  component={RouterLink}
                  to={tool.route}
                  startIcon={getToolIcon(tool.iconKey)}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    color: active ? T.ink.onInverted : T.ink.onInvertedMuted,
                    bgcolor: active ? tone.main : 'transparent',
                    fontWeight: active ? 750 : 600,
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: active ? tone.dark : 'rgba(255,255,255,.10)', color: T.ink.onInverted },
                    '&:focus-visible': { outline: 'none', boxShadow: T.focus.ringInverted },
                  }}
                >
                  {tool.navLabel}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ flex: { xs: 1, md: 0 } }} />

          {user && (
            <Stack direction="row" alignItems="center" gap={.5}>
              <Typography
                variant="caption"
                sx={{ display: { xs: 'none', lg: 'block' }, color: T.ink.onInvertedMuted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.username}
              </Typography>
              {isAdmin && (
                <Tooltip title="Painel administrativo">
                  <IconButton color="inherit" onClick={() => go('/admin')} aria-label="Abrir painel administrativo">
                    <AdminPanelSettingsOutlinedIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Sair">
                <IconButton color="inherit" onClick={onLogout} aria-label="Sair da conta">
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={location.pathname} onNavigate={go} isAdmin={isAdmin} tools={navTools} />

      {/* A trilha só aparece fora da home: lá ela diria apenas "Início". */}
      {trail.length > 1 && (
        <Box sx={{ bgcolor: T.surface.raised, borderBottom: `1px solid ${T.border.subtle}` }}>
          <Box sx={{ maxWidth: T.layout.wide, mx: 'auto', px: { xs: 2, md: 3 }, py: 1 }}>
            <Breadcrumbs
              aria-label="Trilha de navegação"
              separator={<ChevronRightIcon sx={{ fontSize: 16, color: T.ink.subtle }} />}
              sx={{ '& .MuiBreadcrumbs-li': { display: 'flex' } }}
            >
              {trail.map((step) =>
                step.route ? (
                  <Link
                    key={step.label}
                    component={RouterLink}
                    to={step.route}
                    underline="hover"
                    sx={{ fontSize: T.fontSize.caption, fontWeight: 650, color: T.ink.muted }}
                  >
                    {step.label}
                  </Link>
                ) : (
                  <Typography key={step.label} sx={{ fontSize: T.fontSize.caption, fontWeight: 700, color: T.ink.strong }} aria-current="page">
                    {step.label}
                  </Typography>
                ),
              )}
            </Breadcrumbs>
          </Box>
        </Box>
      )}

      <Box component="main" id="conteudo" tabIndex={-1} sx={{ flex: 1, outline: 'none' }}>
        {children}
      </Box>

      <Box component="footer" sx={{ bgcolor: T.surface.inverted, color: T.ink.onInvertedMuted, mt: 'auto' }}>
        <Box
          sx={{
            maxWidth: T.layout.wide,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            py: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <Wordmark tone="inverted" size="sm" />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Atalho para o conteúdo. Fica fora da tela até receber foco — o primeiro
 * `Tab` de qualquer página o revela, e ele pula os sete controles do cabeçalho.
 */
function SkipLink() {
  return (
    <Box
      component="a"
      href="#conteudo"
      sx={{
        position: 'absolute',
        left: 8,
        top: -64,
        zIndex: (muiTheme) => muiTheme.zIndex.appBar + 2,
        px: 2,
        py: 1.25,
        borderRadius: `${T.radius.sm}px`,
        bgcolor: T.surface.raised,
        color: T.ink.accent,
        fontWeight: 750,
        fontSize: T.fontSize.small,
        textDecoration: 'none',
        boxShadow: T.shadow.raised,
        transition: `top ${T.motion.fast}`,
        '&:focus': { top: 8 },
      }}
    >
      Ir para o conteúdo
    </Box>
  );
}

function NavDrawer({ open, onClose, pathname, onNavigate, isAdmin, tools }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 300, bgcolor: T.surface.raised } } }}
    >
      <Box sx={{ bgcolor: T.surface.inverted, px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark tone="inverted" />
        <IconButton onClick={onClose} sx={{ color: T.ink.onInverted }} aria-label="Fechar menu">
          <CloseIcon />
        </IconButton>
      </Box>

      <List component="nav" aria-label="Ferramentas" sx={{ py: 1 }}>
        {tools.map((tool) => {
          const active = isActive(pathname, tool.route, tool.matchPrefix);
          const tone = T.tools[tool.themeKey];
          return (
            <React.Fragment key={tool.route}>
              <ListItemButton
                onClick={() => onNavigate(tool.route)}
                selected={active}
                aria-current={active ? 'page' : undefined}
                sx={{ mx: 1, borderRadius: `${T.radius.sm}px`, '&.Mui-selected': { bgcolor: tone.main, color: tone.contrast }, '&.Mui-selected:hover': { bgcolor: tone.dark } }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: active ? tone.contrast : tone.main }}>{getToolIcon(tool.iconKey)}</ListItemIcon>
                <ListItemText
                  primary={tool.label}
                  slotProps={{ primary: { fontWeight: active ? 750 : 600, fontSize: T.fontSize.small, color: active ? tone.contrast : T.ink.strong } }}
                />
              </ListItemButton>

              {/* As categorias do catálogo passam a ser alcançáveis de qualquer
                  tela. Antes exigiam ir ao catálogo e clicar num cartão, e
                  trocar de categoria exigia voltar dois níveis. */}
              {(tool.children || []).map((child) => {
                const childActive = pathname === child.route;
                return (
                  <ListItemButton
                    key={child.route}
                    onClick={() => onNavigate(child.route)}
                    selected={childActive}
                    aria-current={childActive ? 'page' : undefined}
                    sx={{ mx: 1, pl: 6, borderRadius: `${T.radius.sm}px`, py: .5, '&.Mui-selected': { bgcolor: tone.main }, '&.Mui-selected:hover': { bgcolor: tone.dark } }}
                  >
                    <ListItemText
                      primary={child.label}
                      slotProps={{ primary: { fontSize: T.fontSize.caption, fontWeight: childActive ? 700 : 500, color: childActive ? tone.contrast : T.ink.muted } }}
                    />
                  </ListItemButton>
                );
              })}
            </React.Fragment>
          );
        })}
      </List>

      {isAdmin && (
        <>
          <Divider sx={{ mx: 2 }} />
          <List sx={{ py: 1 }}>
            <ListItemButton onClick={() => onNavigate('/admin')} sx={{ mx: 1, borderRadius: `${T.radius.sm}px` }}>
              <ListItemIcon sx={{ minWidth: 38, color: T.ink.muted }}><AdminPanelSettingsOutlinedIcon /></ListItemIcon>
              <ListItemText primary="Administração" slotProps={{ primary: { fontWeight: 600, fontSize: T.fontSize.small } }} />
            </ListItemButton>
          </List>
        </>
      )}
    </Drawer>
  );
}
