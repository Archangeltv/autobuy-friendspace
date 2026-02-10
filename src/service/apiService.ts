import "dotenv/config"

export const validateWallet = async (wallet: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(`${process.env.BASE_URL}/user/${wallet}`, {
            signal: controller.signal
        });
        const { data } = await response.json();

        if (data === null) {
          return null;
        }
          return {
            twitterUsername: data.twitter_username,
            wallet
          };
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('validateWallet API call timed out');
        } else {
            console.error('Error in validateWallet:', error);
        }
        return null;
    } finally {
        clearTimeout(timeout);
    }
}