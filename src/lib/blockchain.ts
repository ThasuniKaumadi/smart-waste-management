import { ethers } from 'ethers'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!

const CONTRACT_ABI = [
    "function logCollection(string memory routeId, string memory driverId, string memory status) public",
    "function logComplaint(string memory complaintId, string memory district) public",
    "function logDelivery(string memory deliveryId, string memory materialType) public",
    "event CollectionLogged(string routeId, string driverId, string status, uint256 timestamp)",
    "event ComplaintLogged(string complaintId, string district, uint256 timestamp)",
    "event DeliveryLogged(string deliveryId, string materialType, uint256 timestamp)",
]

export async function logCollectionOnChain(
    routeId: string,
    driverId: string,
    status: string
): Promise<string | null> {
    try {
        if (!window.ethereum) return null

        const provider = new ethers.BrowserProvider(window.ethereum)
        await provider.send("eth_requestAccounts", [])
        const signer = await provider.getSigner()

        const network = await provider.getNetwork()
        if (network.chainId !== BigInt(80002)) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x13882' }],
            })
        }

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
        const tx = await contract.logCollection(routeId, driverId, status)
        const receipt = await tx.wait()
        return receipt.hash
    } catch (error) {
        console.error('Blockchain error:', error)
        return null
    }
}

export async function logComplaintOnChain(
    complaintId: string,
    district: string
): Promise<string | null> {
    try {
        if (!window.ethereum) return null

        const provider = new ethers.BrowserProvider(window.ethereum)
        await provider.send("eth_requestAccounts", [])
        const signer = await provider.getSigner()

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
        const tx = await contract.logComplaint(complaintId, district)
        const receipt = await tx.wait()
        return receipt.hash
    } catch (error) {
        console.error('Blockchain error:', error)
        return null
    }
}

export async function logDeliveryOnChain(
    deliveryId: string,
    materialType: string
): Promise<string | null> {
    try {
        if (!window.ethereum) return null

        const provider = new ethers.BrowserProvider(window.ethereum)
        await provider.send("eth_requestAccounts", [])
        const signer = await provider.getSigner()

        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
        const tx = await contract.logDelivery(deliveryId, materialType)
        const receipt = await tx.wait()
        return receipt.hash
    } catch (error) {
        console.error('Blockchain error:', error)
        return null
    }
}