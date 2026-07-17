import React, { useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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
import { generateResearchPrompt } from '../domain/promptGenerator';
import { buildCatalogTemplate, downloadTemplateBuffer } from '../services/catalogTemplate';

export default function PromptGeneratorPage() {
  const [form, setForm] = useState({ category: 'researcher', context: '', purpose: '', geography: '', quantity: '', extraCriteria: '' });
  const [prompt, setPrompt] = useState('');
  const [snack, setSnack] = useState('');

  function change(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function generate() {
    setPrompt(generateResearchPrompt(form));
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setSnack('Prompt copiado.');
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prompt-deep-research-senai.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadTemplate() {
    try {
      const buffer = await buildCatalogTemplate(form.category);
      downloadTemplateBuffer(buffer, form.category);
      setSnack('Template XLSX baixado.');
    } catch (error) {
      setSnack(error.message || 'Não foi possível gerar o template.');
    }
  }

  return (
    <Box sx={{ maxWidth: 1160, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
      <Typography variant="overline" color="secondary.main" fontWeight={800}>GERADOR DE PROMPT</Typography>
      <Typography variant="h3" sx={{ mt: 1, fontSize: { xs: '2rem', md: '3rem' } }}>Prepare uma Deep Research comparável.</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 780 }}>Responda às perguntas e copie um prompt que pode ser usado em qualquer IA. A ferramenta não executa a pesquisa e não salva suas respostas.</Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Entenda sua busca</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Categoria</InputLabel>
                <Select label="Categoria" value={form.category} onChange={(event) => change('category', event.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField fullWidth multiline minRows={3} label="O que você quer pesquisar?" value={form.context} onChange={(event) => change('context', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: organizações que formam profissionais para IA na indústria." />
              <TextField fullWidth label="Para que você usará o resultado?" value={form.purpose} onChange={(event) => change('purpose', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: convidados e parceiros para um programa." />
              <TextField fullWidth label="Geografia ou idioma" value={form.geography} onChange={(event) => change('geography', event.target.value)} sx={{ mb: 2 }} placeholder="Ex.: Brasil e países da OCDE." />
              <TextField fullWidth type="number" label="Quantidade máxima" value={form.quantity} onChange={(event) => change('quantity', event.target.value)} sx={{ mb: 2 }} />
              <TextField fullWidth multiline minRows={3} label="Critérios que você gostaria de considerar" value={form.extraCriteria} onChange={(event) => change('extraCriteria', event.target.value)} placeholder="Se não souber, deixe vazio. O prompt já inclui critérios públicos e institucionais." />
              <Button fullWidth variant="contained" startIcon={<AutoAwesomeIcon />} onClick={generate} sx={{ mt: 2 }}>Gerar prompt</Button>
              <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate} sx={{ mt: 1 }}>Baixar template XLSX</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ height: '100%', bgcolor: '#0b1f33', color: 'white' }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight={800}>Prompt pronto para copiar</Typography>
              {!prompt ? <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 300 }}><Typography color="rgba(255,255,255,.65)" textAlign="center">Suas respostas aparecerão aqui em um prompt estruturado.</Typography></Box> : <TextField multiline fullWidth value={prompt} InputProps={{ readOnly: true }} sx={{ mt: 2, flex: 1, '& .MuiInputBase-root': { color: 'rgba(255,255,255,.9)', alignItems: 'flex-start', fontFamily: 'monospace', fontSize: 13, height: '100%' }, '& textarea': { height: '100% !important', overflow: 'auto !important' }, '& fieldset': { borderColor: 'rgba(255,255,255,.3)' } }} />}
              {prompt && <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}><Button variant="contained" color="secondary" startIcon={<ContentCopyIcon />} onClick={copyPrompt}>Copiar</Button><Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.5)' }} startIcon={<DownloadIcon />} onClick={downloadPrompt}>Baixar TXT</Button></Box>}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Snackbar open={Boolean(snack)} autoHideDuration={2500} message={snack} onClose={() => setSnack('')} />
    </Box>
  );
}
