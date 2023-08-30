import * as plugins from '../plugins';
import * as db from '../database'; // Import the 'db' module with proper type declarations
import * as utils from '../utils';

interface Reward {
    id: string;
    rewards: {
        rewardName: string;
        rewardAmount: number;
        // Add other properties and their types as needed
    };
    condition: string;
    // Define other properties as needed
}

interface RewardsData {
    active: Reward[];
    conditions: any[]; // Define the actual type for conditions
    conditionals: any[]; // Define the actual type for conditionals
    rewards: Reward[];
}

const rewards: {
    save: (data: Reward[]) => Promise<Reward[]>;
    delete: (data: Reward) => Promise<void>;
    get: () => Promise<RewardsData>;
} = {
    save: async function (data: Reward[]) {
        async function save(data: Reward) {
            if (!Object.keys(data.rewards).length) {
                return;
            }
            const rewardsData = data.rewards;
            delete data.rewards;
            if (!parseInt(data.id, 10)) {
                // Ensure that 'db' has the 'incrObjectField' method and type
                if (typeof db.incrObjectField === 'function') {
                    data.id = await (db).incrObjectField('global', 'rewards:id'); // Type assertion for 'db'
                } else {
                    throw new Error('db.incrObjectField is not a function');
                }
            }
            await rewards.delete(data);
            await db.setAdd('rewards:list', data.id);
            await db.setObject(`rewards:id:${data.id}`, data);
            await db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
        }

        await Promise.all(data.map(data => save(data)));
        await saveConditions(data);
        return data;
    },

    delete: async function (data: Reward) {
        await Promise.all([
            db.setRemove('rewards:list', data.id),
            db.delete(`rewards:id:${data.id}`),
            db.delete(`rewards:id:${data.id}:rewards`),
        ]);
    },

    get: async function () {
        return await utils.promiseParallel({
            active: getActiveRewards(),
            conditions: plugins.hooks.fire('filter:rewards.conditions', []),
            conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
            rewards: plugins.hooks.fire('filter:rewards.rewards', []),
        });
    },
};

async function saveConditions(data: Reward[]) {
    const rewardsPerCondition: { [condition: string]: string[] } = {};
    await db.delete('conditions:active');
    const conditions: string[] = [];

    data.forEach((reward: Reward) => {
        conditions.push(reward.condition);
        rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
        rewardsPerCondition[reward.condition].push(reward.id);
    });

    await db.setAdd('conditions:active', conditions);

    await Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
}

async function getActiveRewards() {
    async function load(id: string) {
        const [main, rewards] = await Promise.all([
            db.getObject(`rewards:id:${id}`),
            db.getObject(`rewards:id:${id}:rewards`),
        ]);
        if (main) {
            main.disabled = main.disabled === 'true';
            main.rewards = rewards;
        }
        return main;
    }

    const rewardsList = await db.getSetMembers('rewards:list');
    const rewardData = await Promise.all(rewardsList.map(id => load(id)));
    return rewardData.filter(Boolean);
}

require('../promisify')(rewards);

export default rewards;

