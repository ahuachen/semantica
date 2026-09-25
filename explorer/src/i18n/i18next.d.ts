import 'i18next';

import type common from './locales/en/common.json';
import type graph from './locales/en/graph.json';
import type ontology from './locales/en/ontology.json';
import type workspaces from './locales/en/workspaces.json';

// Makes t() keys type-checked against the English catalogues, so a typo or a
// key dropped from en/*.json fails the build instead of rendering the raw key.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      graph: typeof graph;
      ontology: typeof ontology;
      workspaces: typeof workspaces;
    };
  }
}
