import React, { useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CATEGORY_LABELS } from '../domain/interview';
import { getCatalogHeaders } from '../domain/catalogImportSchema';
import { generateResearchPrompt } from '../domain/promptGenerator';
import { buildCatalogTemplate, downloadTemplateBuffer } from '../services/catalogTemplate';
import PageContainer from '../design-system/primitives/PageContainer';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

export default function PromptGeneratorPage() {
  const [form, setForm] = useState({ category: 'person', context: '', purpose: '', geography: '', quantity: '', extraCriteria: '', personProfiles: '', sourcePreferences: '' });
  const [prompt, setPrompt] = useState('');
  const [snack, setSnack] = useState('');

  function change(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function generate() {
    setPrompt(generateResearchPrompt({ ...form, columns: getCatalogHeaders(form.category) }));
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setSnack('Pedido copiado.');
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pedido-de-pesquisa-senai.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadTemplate() {
    try {
      const buffer = await buildCatalogTemplate(form.category, getCatalogHeaders(form.category));
      downloadTemplateBuffer(buffer, form.category);
      setSnack('Template XLSX baixado.');
    } catch (error) {
      setSnack(error.message || 'Não foi possível gerar o template.');
    }
  }

  return (
    <PageContainer width="page" tool="prompt">
      <Typography variant="overline" sx={{ color: T.tools.prompt.dark, fontWeight: 800 }}>PREPARAR PESQUISA</Typography>
      <Typography variant="h3" sx={{ mt: 1, fontSize: { xs: '2rem', md: '3rem' } }}>Monte um pedido claro para pesquisar com IA</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 780 }}>Explique o que precisa. O Farol organiza as instruções para você copiar e usar na ferramenta de sua preferência.</Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={800}>Conte o que você precisa</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>
                Preencha o que souber. Os campos opcionais podem ficar vazios.
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Quem você quer encontrar?</InputLabel>
                <Select label="Quem você quer encontrar?" value={form.category} onChange={(event) => change('category', event.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </Select>
              </FormControl>
              {form.category === 'person' && <>
                <TextField fullWidth label="Que experiência profissional procura?" value={form.personProfiles} onChange={(event) => change('personProfiles', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: indústria, pesquisa, imprensa ou gestão pública." />
                <TextField fullWidth label="Onde prefere localizar ou verificar?" value={form.sourcePreferences} onChange={(event) => change('sourcePreferences', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: LinkedIn, imprensa e páginas institucionais." />
              </>}
              <TextField fullWidth multiline minRows={2} label="O que você procura?" value={form.context} onChange={(event) => change('context', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: organizações que formam profissionais para IA na indústria." />
              <TextField fullWidth label="Como pretende usar o resultado?" value={form.purpose} onChange={(event) => change('purpose', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: convidar parceiros para um novo programa." />
              <TextField fullWidth label="País ou idioma (opcional)" value={form.geography} onChange={(event) => change('geography', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: Brasil, em português." />
              <TextField fullWidth type="number" label="Quantas sugestões quer receber?" value={form.quantity} onChange={(event) => change('quantity', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: 10" />
              <TextField fullWidth multiline minRows={2} label="O que é importante considerar? (opcional)" value={form.extraCriteria} onChange={(event) => change('extraCriteria', event.target.value)} placeholder="Ex.: experiência comprovada e disponibilidade para encontros remotos." />
              <Button fullWidth variant="contained" startIcon={<SearchIcon />} onClick={generate} sx={{ mt: 2 }}>Criar pedido</Button>
              <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate} sx={{ mt: 1 }}>Baixar modelo de planilha</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ height: 520, bgcolor: T.surface.inverted, color: T.ink.onInverted }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight={800}>Pedido pronto para copiar</Typography>
              {!prompt ? <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}><Typography color="rgba(255,255,255,.65)" textAlign="center">Preencha o que souber e clique em Criar pedido.</Typography></Box> : <Box component="pre" role="region" aria-label="Pedido de pesquisa gerado" tabIndex={0} sx={{ mt: 2, mb: 0, flex: 1, minHeight: 0, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'rgba(255,255,255,.9)', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>{prompt}</Box>}
              {prompt && <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}><Button variant="contained" color="primary" startIcon={<ContentCopyIcon />} onClick={copyPrompt}>Copiar pedido</Button><Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.5)' }} startIcon={<DownloadIcon />} onClick={downloadPrompt}>Baixar texto</Button></Box>}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Snackbar open={Boolean(snack)} autoHideDuration={2500} message={snack} onClose={() => setSnack('')} />
    </PageContainer>
  );
}
