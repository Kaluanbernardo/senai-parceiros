import React, { useMemo, useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CATEGORY_LABELS } from '../domain/interview';
import { getCatalogHeaders } from '../domain/catalogImportSchema';
import { ORGANIZATION_SUBTYPES, PERSON_SUBTYPES } from '../domain/catalogTaxonomy';
import { generateResearchPrompt } from '../domain/promptGenerator';
import { buildCatalogTemplate, downloadTemplateBuffer } from '../services/catalogTemplate';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

/** Rótulo de grupo. Nove campos de peso idêntico viram um questionário sem forma. */
function FieldGroup({ step, title, children }) {
  return (
    <Box>
      <Typography variant="overline" sx={{ color: T.tools.prompt.dark }}>{step}. {title}</Typography>
      <Stack gap={2} sx={{ mt: 1.25 }}>{children}</Stack>
    </Box>
  );
}

export default function PromptGeneratorPage() {
  const [form, setForm] = useState({ category: 'person', subtype: '', context: '', purpose: '', geography: '', quantity: '', extraCriteria: '', personProfiles: '', sourcePreferences: '' });
  const [showOptional, setShowOptional] = useState(false);
  const [snack, setSnack] = useState('');

  function change(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  /**
   * O pedido se monta enquanto a pessoa escreve.
   *
   * O painel só ganhava conteúdo depois de um clique em "Criar pedido", então o
   * maior elemento da tela passava a maior parte do tempo vazio e nada ligava
   * um campo ao efeito que ele produz no texto. Ver o pedido crescer é o que
   * ensina o que cada campo faz — e é o que faz alguém voltar e preencher
   * melhor.
   */
  const prompt = useMemo(
    () => generateResearchPrompt({ ...form, columns: getCatalogHeaders(form.category) }),
    [form],
  );

  const optionalCount = [form.geography, form.quantity, form.extraCriteria].filter((value) => String(value).trim()).length;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setSnack('Pedido copiado.');
    } catch {
      setSnack('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
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
    <PageContainer width="wide" tool="prompt">
      {/* Esta era a única tela que montava o próprio cabeçalho, com tamanhos
          escolhidos à mão: o título saía maior que o de todas as outras e o
          conteúdo deslizava de lado a cada navegação. */}
      <PageHeader
        eyebrow="PESQUISA EXTERNA"
        title="Monte um pedido claro para pesquisar com IA"
        description="Explique o que precisa. O Farol organiza as instruções para você copiar e usar na ferramenta de sua preferência."
        accent="prompt"
        dense
      />

      <Grid container spacing={3} sx={{ mt: 1 }} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Stack gap={3}>
                <FieldGroup step={1} title="Quem você procura">
                  <FormControl fullWidth>
                    <InputLabel>Quem você quer encontrar?</InputLabel>
                    <Select label="Quem você quer encontrar?" value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value, subtype: '' }))}>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Subtipo (opcional)</InputLabel>
                    <Select label="Subtipo (opcional)" value={form.subtype} onChange={(event) => change('subtype', event.target.value)}>
                      <MenuItem value="">Todos os subtipos</MenuItem>
                      {(form.category === 'person' ? PERSON_SUBTYPES : ORGANIZATION_SUBTYPES).map((subtype) => <MenuItem key={subtype} value={subtype}>{subtype}</MenuItem>)}
                    </Select>
                  </FormControl>
                  {form.category === 'person' && (
                    <TextField fullWidth label="Que experiência profissional procura?" value={form.personProfiles} onChange={(event) => change('personProfiles', event.target.value)} placeholder="Ex.: indústria, pesquisa, imprensa ou gestão pública." />
                  )}
                </FieldGroup>

                <FieldGroup step={2} title="O que precisa aparecer">
                  <TextField fullWidth multiline minRows={3} label="O que você procura?" value={form.context} onChange={(event) => change('context', event.target.value)} placeholder="Ex.: organizações que formam profissionais para IA na indústria." />
                  <TextField fullWidth label="Como pretende usar o resultado?" value={form.purpose} onChange={(event) => change('purpose', event.target.value)} placeholder="Ex.: convidar parceiros para um novo programa." />
                  {form.category === 'person' && (
                    <TextField fullWidth label="Onde prefere localizar ou verificar?" value={form.sourcePreferences} onChange={(event) => change('sourcePreferences', event.target.value)} placeholder="Ex.: LinkedIn, imprensa e páginas institucionais." />
                  )}
                </FieldGroup>

                <Box>
                  {/* Recolher os opcionais encurta o formulário à metade sem
                      esconder nada: eles ocupavam o mesmo espaço dos
                      obrigatórios, com "(opcional)" perdido no rótulo. */}
                  <Button
                    fullWidth
                    onClick={() => setShowOptional((current) => !current)}
                    endIcon={<ExpandMoreIcon sx={{ transform: showOptional ? 'rotate(180deg)' : 'none', transition: `transform ${T.motion.fast}` }} />}
                    sx={{ justifyContent: 'space-between', color: T.ink.muted }}
                    aria-expanded={showOptional}
                  >
                    3. Detalhes opcionais{optionalCount > 0 ? ` (${optionalCount} preenchidos)` : ''}
                  </Button>
                  <Collapse in={showOptional}>
                    <Stack gap={2} sx={{ mt: 1.5 }}>
                      <TextField fullWidth label="País ou idioma" value={form.geography} onChange={(event) => change('geography', event.target.value)} placeholder="Ex.: Brasil, em português." />
                      <TextField fullWidth type="number" label="Quantas sugestões quer receber?" value={form.quantity} onChange={(event) => change('quantity', event.target.value)} placeholder="Ex.: 10" />
                      <TextField fullWidth multiline minRows={2} label="O que é importante considerar?" value={form.extraCriteria} onChange={(event) => change('extraCriteria', event.target.value)} placeholder="Ex.: experiência comprovada e disponibilidade para encontros remotos." />
                    </Stack>
                  </Collapse>
                </Box>

                <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                  Baixar modelo de planilha
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ height: { md: 640 }, bgcolor: T.surface.inverted, color: T.ink.onInverted, position: { md: 'sticky' }, top: { md: T.layout.headerHeight + 16 } }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                <Typography variant="h6" fontWeight={800}>Seu pedido</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>
                  atualiza enquanto você escreve
                </Typography>
              </Stack>
              <Box
                component="pre"
                role="region"
                aria-label="Pedido de pesquisa gerado"
                aria-live="polite"
                tabIndex={0}
                sx={{ mt: 2, mb: 0, flex: 1, minHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'rgba(255,255,255,.9)', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
              >
                {prompt}
              </Box>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
                <Button variant="contained" color="primary" startIcon={<ContentCopyIcon />} onClick={copyPrompt}>Copiar pedido</Button>
                <Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.5)' }} startIcon={<DownloadIcon />} onClick={downloadPrompt}>Baixar texto</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={Boolean(snack)} autoHideDuration={2500} message={snack} onClose={() => setSnack('')} />
    </PageContainer>
  );
}
