import React from 'react';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BusinessIcon from '@mui/icons-material/Business';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import RadarIcon from '@mui/icons-material/Radar';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';

const ICONS = {
  selection: SearchIcon,
  catalog: LibraryBooksIcon,
  radar: RadarIcon,
  prompt: AutoAwesomeIcon,
  researcher: ScienceIcon,
  school: SchoolIcon,
  organization: BusinessIcon,
};

export function getToolIcon(iconKey) {
  const Icon = ICONS[iconKey] || LibraryBooksIcon;
  return <Icon />;
}
