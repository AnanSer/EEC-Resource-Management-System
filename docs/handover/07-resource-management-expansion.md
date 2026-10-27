# 07. Resource Management System Expansion Architecture

## 1. Vision: Transitioning from IT EAMS to Enterprise RMS

The existing EEC Asset Management System was originally tailored around ICT hardware (laptops, desktops, servers, network switches). However, the Ethiopian Engineering Corporation's primary operational assets include **vehicles, heavy civil machinery, geodetic surveying gear, geotechnical testing equipment, and site infrastructure**.

The goal of the **Resource Management System (RMS)** is to extend the proven business logic, approval workflows, and custody tracking of the original system into a comprehensive multi-category enterprise platform.

---

## 2. Architectural Blueprint: What to Reuse vs. What to Evolve

```mermaid
graph TD
    subgraph Reusable Proven Core
        C1[Organization & Department Hierarchy]
        C2[5-Tier RBAC & Security Middleware]
        C3[Requisition -> Admin Approval -> Custody Handover]
        C4[Dynamic Inventory Derivation Single Source of Truth]
        C5[Maintenance Lifecycle & QA Testing Gate]
        C6[In-App Notification & Notification Matrix]
    end

    subgraph Architectural Evolutions
        E1[Polymorphic / Extension Resource Tables]
        E2[Multi-Site & Field Project Locations]
        E3[Hour-Meter & Mileage Triggered Maintenance]
        E4[Regulatory Expiry & Calibration Tracking]
    end

    subgraph New Domain Modules
        M1[Fleet & Vehicle Management]
        M2[Heavy Plant & Construction Machinery]
        M3[Surveying & Laboratory Calibration]
        M4[Gate Pass & Dispatch Vouchers]
    end

    Reusable Proven Core --> Architectural Evolutions
    Architectural Evolutions --> New Domain Modules
```

---

## 3. Resource Classification & Type-Specific Specifications

Instead of a single flat enum (`AssetCategory`), the RMS should establish a two-level taxonomy: **Resource Category** and **Resource Type**, with type-specific attributes stored in dedicated extension tables or structured JSONB fields.

### 3.1 Category 1: IT & Office Technology (Existing Foundation)
- **Equipment Types**: Laptops, Desktops, Servers, Printers, Plotters, Network Switches, Enterprise UPS.
- **Attributes**: Serial Number, Processor/RAM/Storage specs, OS License, MAC Address, Hostname.
- **Custody Unit**: Assigned to individual corporate employee.

### 3.2 Category 2: Vehicles & Transport Fleet
- **Equipment Types**: Field 4WD Pickups (Toyota Land Cruiser / Hilux), Station Wagons, Cargo Trucks, Staff Commuter Buses.
- **Attributes**:
  - `plateNumber`: Vehicle registration license plate (e.g., "3-ET-A12345").
  - `chassisNumber` / `vin`: Chassis / Vehicle Identification Number.
  - `engineNumber`: Engine block serial number.
  - `currentMileageKm`: Current odometer reading.
  - `fuelType`: Diesel, Regular Gasoline, Hybrid, Electric.
  - `insuranceExpiryDate`: Third-party and comprehensive insurance policy expiration.
  - `annualInspectionExpiry`: Ethiopian Road Transport Authority annual inspection ("Bolo") renewal date.
  - `assignedDriverId`: Employee ID of designated certified driver.

### 3.3 Category 3: Heavy Plant & Construction Machinery
- **Equipment Types**: Excavators, Bulldozers, Motor Graders, Wheel Loaders, Mobile Cranes, Concrete Mixers, Soil Compactors.
- **Attributes**:
  - `machineSerial`: Manufacturer serial number.
  - `operatingHours`: Cumulative operating hours counter (SMU / Hour Meter).
  - `serviceIntervalHours`: Standard maintenance interval (e.g., every 250 or 500 operating hours).
  - `enginePowerKw` / `tonnage`: Capacity rating.
  - `projectSiteId`: Current assigned civil engineering project (e.g., "GERD Sub-station", "Dire Dawa Industrial Park").
  - `certifiedOperatorId`: Certified heavy equipment operator assigned to the machine.

### 3.4 Category 4: Geotechnical, Surveying & Metrology Equipment
- **Equipment Types**: Total Stations, RTK GNSS/GPS Receivers, Digital Levels, Soil Compression Testers, Core Drilling Rigs, Laser Scanners.
- **Attributes**:
  - `calibrationCertificateNumber`: Official calibration certificate identifier.
  - `calibrationDate`: Date of last laboratory calibration.
  - `calibrationExpiryDate`: Mandatory recalibration due date (blocks checkout if expired).
  - `measurementAccuracy`: Angular/linear precision rating.
  - `accessoriesChecklist`: Carrying case, tripods, prism poles, rechargeable battery packs.

### 3.5 Category 5: Facility, Site Camp & Office Furniture
- **Equipment Types**: Diesel Backup Generators, Industrial Water Pumps, Prefabricated Office Containers, Conference Tables, Executive Desks.
- **Attributes**: Power rating (kVA), discharge rate (L/min), structural dimensions, serial tag.

---

## 4. Workflows Requiring Adaptation for Resources

### 4.1 Deployment to Field Project Sites vs. Individual Staff
- **Original AMS**: Assets were strictly assigned to an individual employee (`employeeId`).
- **RMS Evolution**: Heavy machinery and survey gear are frequently deployed to a **Civil Project Site** or **Field Camp** where a team of engineers and operators share the resource.
- **Recommendation**: Expand `AssetAssignment` (or create `ResourceDeployment`) to support:
  - `deploymentType`: `'INDIVIDUAL'` | `'PROJECT_SITE'` | `'DEPARTMENTAL_POOL'`.
  - `projectSite`: Link to civil engineering project master data.
  - `siteSupervisorId`: Designates the on-site engineer holding custodial accountability.

### 4.2 Meter-Based Maintenance vs. Calendar Maintenance
- **Original AMS**: Maintenance was initiated ad-hoc when equipment was damaged or reported broken.
- **RMS Evolution**: Vehicles and machinery require **Preventive Maintenance (PM)** triggered by usage metrics:
  - Vehicles: Every 5,000 km oil change; every 40,000 km major service.
  - Machinery: Every 250 operating hours hydraulic and filter service.
- **Recommendation**: Add a periodic mileage/hours logging endpoint that automatically flags equipment as `NEEDS_SERVICE` when target thresholds are reached.

### 4.3 Gate Pass & Material Transfer Vouchers (MIV / SIV)
- In Ethiopian state-owned enterprises (SOEs), physical equipment leaving corporate compounds requires signed physical or digital documentation:
  - **Store Issue Voucher (SIV)**: Formal transfer from central warehouse to user/site.
  - **Gate Pass**: Security permit authorizing security gatekeepers to allow high-value machinery or vehicles through compound gates.
- **Recommendation**: Implement printable PDF voucher generation (with QR code verification) upon request fulfillment.

---

## 5. Decisions Requiring Management Confirmation

Before final implementation of the expanded modules, the following operational requirements must be officially confirmed by EEC management:

| # | Topic | Key Question for Management | Architectural Impact |
| :--- | :--- | :--- | :--- |
| **1** | **Custody Model for Machinery** | Are heavy construction machines assigned to the project site supervisor, or to individual certified operators? | Affects `ResourceAssignment` foreign key constraints and responsibility tracking. |
| **2** | **Fleet Fuel Tracking** | Will daily fuel vouchers, logbooks, and fuel card transactions be tracked inside RMS, or via existing fuel cards? | Determines whether to build a full `FuelLog` ledger or keep fleet tracking limited to mileage and maintenance. |
| **3** | **Regulatory Alert Lead Time** | What is the corporate notification window for vehicle insurance and roadworthiness ("Bolo") renewal (30 days, 60 days)? | Configures scheduled background cron jobs for regulatory compliance alerts. |
| **4** | **Calibration Enforcement** | If a surveying instrument's calibration certificate expires, should the system strictly block staff from checking it out? | Determines whether calibration expiry acts as a hard validation block (`422 Unprocessable Entity`) or a soft warning. |
| **5** | **Approval Authority Matrix** | Does high-value equipment requisition (e.g. machinery costing > 5,000,000 ETB) require multi-stage approval (Department Manager -> Equipment Committee -> Director General)? | Influences whether to extend `AssetRequest` from single-stage Admin approval to a multi-stage sequential approval workflow. |
