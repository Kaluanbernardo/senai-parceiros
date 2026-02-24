import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';

const FIELD_CONFIGS = {
  stakeholder: [
    { key: 'nome', label: 'Nome da Instituicao', required: true, multiline: false, gridSize: 12 },
    { key: 'pais', label: 'Pais', required: true, gridSize: 6 },
    { key: 'natureza', label: 'Natureza', required: true, gridSize: 6, select: true, options: ['Publica', 'Privada', 'PPP'] },
    { key: 'diferencial', label: 'Diferencial', multiline: true, rows: 3, gridSize: 12 },
    { key: 'relacao', label: 'Relacao com o SENAI', multiline: true, rows: 3, gridSize: 12 },
    { key: 'website', label: 'Website (URL)', gridSize: 6 },
    { key: 'logo', label: 'Logo (URL)', gridSize: 6 },
  ],
  escola: [
    { key: 'instituicao', label: 'Nome da Instituicao', required: true, gridSize: 12 },
    { key: 'pais', label: 'Pais', required: true, gridSize: 6 },
    { key: 'areas', label: 'Areas de Atuacao (separar com ;)', gridSize: 6 },
    { key: 'relevancia', label: 'Relevancia', multiline: true, rows: 3, gridSize: 12 },
    { key: 'website', label: 'Website (URL)', gridSize: 6 },
    { key: 'logo', label: 'Logo (URL)', gridSize: 6 },
  ],
  pesquisador: [
    { key: 'nome', label: 'Nome do Pesquisador', required: true, gridSize: 6 },
    { key: 'instituicao', label: 'Instituicao', required: true, gridSize: 6 },
    { key: 'pais', label: 'Pais', required: true, gridSize: 4 },
    { key: 'h_index', label: 'h-index', gridSize: 4 },
    { key: 'areas', label: 'Areas de Pesquisa (separar com ;)', gridSize: 4 },
    { key: 'pesquisa', label: 'Descricao da Pesquisa', multiline: true, rows: 4, gridSize: 12 },
    { key: 'scholar', label: 'Google Scholar (URL)', gridSize: 6 },
    { key: 'foto', label: 'Foto (URL)', gridSize: 6 },
  ],
};

function getEmptyItem(type) {
  const fields = FIELD_CONFIGS[type];
  const item = {};
  fields.forEach(f => { item[f.key] = ''; });
  return item;
}

export default function EditDialog({ open, onClose, onSave, item, type, isNew }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      if (isNew) {
        setForm(getEmptyItem(type));
      } else if (item) {
        setForm({ ...item });
      }
      setErrors({});
    }
  }, [open, item, type, isNew]);

  const fields = FIELD_CONFIGS[type] || [];

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (f.required && !form[f.key]?.trim()) {
        newErrors[f.key] = 'Campo obrigatorio';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(form);
    onClose();
  };

  const previewUrl = type === 'pesquisador' ? form.foto : form.logo;
  const previewName = type === 'pesquisador' ? form.nome : (form.nome || form.instituicao);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isNew ? 'Adicionar' : 'Editar'} {type === 'stakeholder' ? 'Stakeholder' : type === 'escola' ? 'Escola' : 'Pesquisador'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 1 }}>
          <Avatar
            src={previewUrl || undefined}
            sx={{ width: 48, height: 48, bgcolor: 'primary.light' }}
          >
            {previewName ? previewName.charAt(0).toUpperCase() : '?'}
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            Preview do avatar. Altere a URL da {type === 'pesquisador' ? 'foto' : 'logo'} para atualizar.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {fields.map(f => (
            <Grid key={f.key} size={{ xs: 12, sm: f.gridSize }}>
              {f.select ? (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={f.label}
                  value={form[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  error={!!errors[f.key]}
                  helperText={errors[f.key]}
                >
                  {f.options.map(opt => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label={f.label}
                  value={form[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  multiline={f.multiline || false}
                  rows={f.rows || 1}
                  error={!!errors[f.key]}
                  helperText={errors[f.key]}
                  required={f.required}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button onClick={handleSave} variant="contained">{isNew ? 'Adicionar' : 'Salvar'}</Button>
      </DialogActions>
    </Dialog>
  );
}
