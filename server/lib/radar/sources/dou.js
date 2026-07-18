import { DirectOfficialWebProvider } from '../web/directOfficial.js';
export { buildDouEditionUrls, isDouUrl } from '../web/urlPolicy.js';

/**
 * Named source adapter for the DOU.  Keeping this thin wrapper makes the
 * source registry explicit while the HTTP policy remains reusable by other
 * official pages.
 */
export class DouSourceAdapter extends DirectOfficialWebProvider {
  constructor(options = {}) {
    super({
      ...options,
      sections: options.sections || process.env.RADAR_DOU_SECTIONS?.split(',') || ['DO1', 'DO3'],
    });
  }
}

export const DOU_SOURCE = Object.freeze({
  name: 'Diário Oficial da União',
  domain: 'in.gov.br',
  sections: ['DO1', 'DO3'],
  official: true,
});

