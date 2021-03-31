import farm from 'worker-farm';
import { SomeObject } from './types';

export class Workers {
    private farm: farm.Workers;

    constructor(name: string) {
        this.farm = farm(name);
    }

    public run(args: SomeObject[], callback: (count: number) => void): Promise<void> {
        let count = 0;
        let total = args.length;

        return new Promise(resolve => {
            for (const arg of args) {
                this.farm(arg, () => {
                    count++;

                    callback(count);

                    if (count === total) {
                        resolve();
                    }
                });
            }
        });
    }

    public end(): void {
        farm.end(this.farm);
    }
}
