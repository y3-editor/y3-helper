import { onLCP, onFID, onCLS, onFCP, onINP, onTTFB } from 'web-vitals';
import userReporter from './report';
import { UserEvent } from '../types/report';

onLCP(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_LCP,
    extends: {
      delta,
      value,
      rating,
    },
  });
});

onFID(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_FID,
    extends: {
      delta,
      value,
      rating,
    },
  });
});

onCLS(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_CLS,
    extends: {
      delta,
      value,
      rating,
    },
  });
});

onFCP(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_FCP,
    extends: {
      delta,
      value,
      rating,
    },
  });
});

onINP(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_INP,
    extends: {
      delta,
      value,
      rating,
    },
  });
});

onTTFB(({ delta, value, rating }) => {
  userReporter.report({
    event: UserEvent.WEB_VITALS_TTFB,
    extends: {
      delta,
      value,
      rating,
    },
  });
});
