import "dotenv/config"


const BASE_URL = process.env.BASE_URL;

interface RoomData {
    room: {
        id: string;
        blockNumber: string;
        contract: string;
        createdAt: string;
        creator: string;
        creatorReward: string;
        currentSupply: string;
        sn: string;
        totalSupply: string | null;
        updatedAt: string;
        metadataId: string;
        volume: string;
        stakeAddress: string;
        sellPrice: string;
        buyPrice: string;
        midPrice: string;
        tier: string;
        featured: boolean;
        fundSize: string;
        pnl: string;
        pnlPercentage7d: string;
        pnlPercentage30d: string;
        pnlPercentageAllTime: string;
        fundPnlUpdatedAt: string;
        votingNotificationSent: boolean;
        bridgeProcessId: string | null;
        withdrawProcessId: string | null;
        roomType: string;
        walletAddress: string;
    };
    creator: {
        address: string;
        bio: string;
        image: string;
        twitter_id: string;
        twitter_username: string;
        points: string;
        pointLastestWeek: string;
        tier: number;
        tierUpdatedAt: string | null;
        addedPointPrelaunch: boolean;
        createdAt: string;
    };
    metadata: {
        id: string;
        name: string;
        description: string;
        image: string;
        animationUrl: string | null;
        type: string;
        banner: string | null;
        externalUrl: string | null;
    };
    room_key: string | null;
    unique_holders: number;
}

const seenRooms = new Set<string>();

const START_TIME = Date.now();

const fetchNewRooms = async (wallet: string) => {
    console.log("Room running")
    try {
        if (!BASE_URL) {
            console.log("BASE_URL is not defined");
            return;
        }

        const response = await fetch(`${BASE_URL}/room/paginate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                featured: false,
                limit: 20,
                sortBy: "createdAt",
                sortDir: "desc",
                userAddress: "0x3dcCfcf598996cE895669D930D37C5725f4bd76d"
            })
        });
        if (!response.ok) {
            console.log(`Failed to fetch rooms: ${response.statusText}`);
            return;
        }

        console.log("Room response");

        const { data }: { data: RoomData[] } = await response.json();

        console.log("Room data");

for (const item of data) {

    if (new Date(item.room.createdAt).getTime() < START_TIME) continue;


    if (!seenRooms.has(item.room.id)) {
        seenRooms.add(item.room.id);

        if (item.creator.address.toLowerCase() === wallet.toLowerCase()) {
            console.log("🔥 Target Room found!", item.room.id);
            return {
                room: item.room, 
                creator: item.creator, 
                tier: item.room.tier, 
                metadata: item.metadata,
                roomId: item.room.id 
            };
        }  else {
            console.log(`Room ${item.room.id} skipped, creator ${item.creator.address} does not match ${wallet}`)
        }
    } else {
        console.log(`Room ${item.room.id} skipped, already seen`)
    }
}
return null; 

    } catch (error) {
        console.log("Error fetching new rooms:", error);
        return null
    }
};

export default fetchNewRooms;