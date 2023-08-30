import plugins from '../plugins';
import db from '../database';
import utils from '../utils';

interface Data {
    id: string
    rewards: Reward[]
    condition: string
    disabled: boolean
}

interface Reward {
    id: string
}

export async function _delete(data: Data) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setRemove('rewards:list', data.id);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete(`rewards:id:${data.id}`);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete(`rewards:id:${data.id}:rewards`);
}

async function getActiveRewards() {
    async function load(id: string) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const main: Data = await db.getObject(`rewards:id:${id}`) as Data;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const rewards: Reward[] = await db.getObject(`rewards:id:${id}:rewards`) as Reward[];
        if (main) {
            main.disabled = main.disabled === true;
            main.rewards = rewards;
        }
        return main;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rewardsList: string[] = await db.getSetMembers('rewards:list') as string[];
    const rewardData = await Promise.all(rewardsList.map(id => load(id)));
    return rewardData.filter(Boolean);
}

async function saveConditions(data: Data[]) {
    const rewardsPerCondition: Record<string, string[]> = {};
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete('conditions:active');
    const conditions = [];

    data.forEach((reward) => {
        conditions.push(reward.condition);
        rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
        rewardsPerCondition[reward.condition].push(reward.id);
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setAdd('conditions:active', conditions);
    async function dbAddSet(c: string) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c]);
    }
    await Promise.all(Object.keys(rewardsPerCondition).map(c => dbAddSet(c)));
}

export async function save(data: Data[]) {
    async function save(data: Data) {
        if (!Object.keys(data.rewards).length) {
            return;
        }
        const rewardsData: Reward[] = data.rewards;
        delete data.rewards;
        if (!parseInt(data.id, 10)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            data.id = await db.incrObjectField('global', 'rewards:id') as string;
        }
        await _delete(data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setAdd('rewards:list', data.id);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`rewards:id:${data.id}`, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
    }

    await Promise.all(data.map(data => save(data)));
    await saveConditions(data);
    return data;
}

export async function get() {
    return await utils.promiseParallel({
        active: getActiveRewards(),
        conditions: plugins.hooks.fire('filter:rewards.conditions', []),
        conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
        rewards: plugins.hooks.fire('filter:rewards.rewards', []),
    });
}
