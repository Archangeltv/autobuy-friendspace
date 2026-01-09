import "dotenv/config"

export const validateWallet = async (wallet: string) => {
    try {
        const response = await fetch(`${process.env.BASE_URL}/user/${wallet}`);
        const {data } = await response.json();

        if (data === null) {
          return null;
        }
          return {
            twitterUsername: data.twitter_username,
            wallet
          };
    } catch (error) {
        console.error('Error in validateWallet:', error);
        return null;
    }
}