import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import FilterListIcon from '@mui/icons-material/FilterList';
import PublicIcon from '@mui/icons-material/Public';
import HandshakeIcon from '@mui/icons-material/Handshake';

export default function StatsBar({ total, filtered, countries, withPartnership = null }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        py: 1,
      }}
    >
      <Chip
        icon={<FilterListIcon />}
        label={`${filtered} de ${total} resultados`}
        variant={filtered < total ? 'filled' : 'outlined'}
        color={filtered < total ? 'primary' : 'default'}
        size="small"
      />
      <Chip
        icon={<PublicIcon />}
        label={`${countries} países`}
        variant="outlined"
        size="small"
      />
      {withPartnership !== null && (
        <Chip
          icon={<HandshakeIcon />}
          label={`${withPartnership} com parceria SENAI`}
          variant="outlined"
          color="success"
          size="small"
        />
      )}
    </Box>
  );
}
