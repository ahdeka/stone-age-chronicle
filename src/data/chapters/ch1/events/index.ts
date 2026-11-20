import type { EventDef } from '../../../../engine';
import { discoveryEvents } from './discovery';
import { peopleEvents } from './people';
import { survivalEvents } from './survival';

export const ch1Events: EventDef[] = [...survivalEvents, ...peopleEvents, ...discoveryEvents];
