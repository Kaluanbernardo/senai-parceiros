import React from 'react';
import Card from '@mui/material/Card';

export default function SectionCard({ children, sx, ...props }) {
  return <Card variant="outlined" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', ...sx }} {...props}>{children}</Card>;
}
