import farm from 'worker-farm';
import { SomeObject } from './types';

export class Workers {
    private farm: farm.Workers;

    constructor(name: string) {
        this.farm = farm(name);
    }

    public run(args: SomeObject[], callback: (stats: SomeObject) => void): Promise<SomeObject> {
        let count = 0;
        let total = args.length;

        const startTime = Date.now();

        return new Promise(resolve => {
            for (const arg of args) {
                this.farm(arg, () => {
                    count++;

                    const elapsedTime = Date.now() - startTime;
                    const totalTime = (elapsedTime / count) * total;
                    const remainingTime = Math.round(totalTime - elapsedTime);

                    callback({ arg, count, total, elapsedTime, remainingTime });

                    if (count === total) {
                        const elapsedTime = Date.now() - startTime;
                        const timePerTask = elapsedTime / total;

                        resolve({ total, elapsedTime, timePerTask });
                    }
                });
            }
        });
    }

    public end(): void {
        farm.end(this.farm);
    }
}
