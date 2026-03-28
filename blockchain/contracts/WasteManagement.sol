// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract WasteManagement {
    address public owner;
    
    struct CollectionEvent {
        string routeId;
        string driverId;
        string address_;
        string status;
        string skipReason;
        uint256 timestamp;
    }
    
    struct ComplaintEvent {
        string complaintId;
        string submittedBy;
        string district;
        string complaintType;
        uint256 timestamp;
    }
    
    struct RecyclerDelivery {
        string deliveryId;
        string recyclerId;
        string driverId;
        string materialType;
        uint256 weight;
        uint256 timestamp;
    }

    CollectionEvent[] public collectionEvents;
    ComplaintEvent[] public complaintEvents;
    RecyclerDelivery[] public recyclerDeliveries;

    event CollectionLogged(string routeId, string driverId, string status, uint256 timestamp);
    event ComplaintLogged(string complaintId, string submittedBy, string district, uint256 timestamp);
    event DeliveryLogged(string deliveryId, string recyclerId, string materialType, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    function logCollection(
        string memory routeId,
        string memory driverId,
        string memory address_,
        string memory status,
        string memory skipReason
    ) public {
        collectionEvents.push(CollectionEvent({
            routeId: routeId,
            driverId: driverId,
            address_: address_,
            status: status,
            skipReason: skipReason,
            timestamp: block.timestamp
        }));
        emit CollectionLogged(routeId, driverId, status, block.timestamp);
    }

    function logComplaint(
        string memory complaintId,
        string memory submittedBy,
        string memory district,
        string memory complaintType
    ) public {
        complaintEvents.push(ComplaintEvent({
            complaintId: complaintId,
            submittedBy: submittedBy,
            district: district,
            complaintType: complaintType,
            timestamp: block.timestamp
        }));
        emit ComplaintLogged(complaintId, submittedBy, district, block.timestamp);
    }

    function logRecyclerDelivery(
        string memory deliveryId,
        string memory recyclerId,
        string memory driverId,
        string memory materialType,
        uint256 weight
    ) public {
        recyclerDeliveries.push(RecyclerDelivery({
            deliveryId: deliveryId,
            recyclerId: recyclerId,
            driverId: driverId,
            materialType: materialType,
            weight: weight,
            timestamp: block.timestamp
        }));
        emit DeliveryLogged(deliveryId, recyclerId, materialType, block.timestamp);
    }

    function getCollectionCount() public view returns (uint256) {
        return collectionEvents.length;
    }

    function getComplaintCount() public view returns (uint256) {
        return complaintEvents.length;
    }

    function getDeliveryCount() public view returns (uint256) {
        return recyclerDeliveries.length;
    }
}