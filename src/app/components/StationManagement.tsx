import { useState } from "react";
import { Search, Plus, Filter, MapPin, Edit, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Station } from "../pages/AdminDashboard";

interface StationManagementProps {
  stations: Station[];
  onViewOnMap: (station: Station) => void;
  onAddStation: (newStation: Station) => void;
  onUpdateStation: (updatedStation: Station) => void;
  onDeleteStation: (stationId: string) => void;
}

export function StationManagement({
  stations,
  onViewOnMap,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
}: StationManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    zone: "KV1",
    type: "node",
    lat: 20.733,
    lng: 106.642,
  });

  const [editingStation, setEditingStation] = useState<Station | null>(null);

  const filteredStations = stations.filter(
    (s) =>
      s.id.toLowerCase() !== "unknown" &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.zone.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // 1. TÍCH HỢP API THÊM TRẠM VÀO DATABASE
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Đóng gói dữ liệu cấu hình theo chuẩn của Server
    const newConfig = {
      id: formData.id,
      name: formData.name,
      zone: formData.zone,
      type: formData.type,
      lat: formData.lat,
      lng: formData.lng,
    };

    try {
      // GỌI API LƯU VÀO MONGODB
      const response = await fetch(
        "https://do-an-r2gd.onrender.com/api/stations/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        },
      );

      if (response.ok) {
        // Nếu Server báo lưu DB thành công, mới bắt đầu vẽ lên giao diện
        const newStation: Station = {
          id: formData.id,
          name: formData.name,
          zone: formData.zone,
          type: formData.type as "node" | "aggregator",
          position: [formData.lat, formData.lng],
          temperature: 0, // Dữ liệu ảo chờ cảm biến thật gửi lên
          humidity: 0,
          light: 0,
          pm25: 0,
          pirMotion: false,
          history: [],
        };
        onAddStation(newStation);
        setIsModalOpen(false);

        // Reset form
        setFormData({ ...formData, id: "", name: "" });
        alert("Đã lưu trạm mới vào Cơ sở dữ liệu thành công!");
      } else {
        alert("Có lỗi xảy ra khi lưu vào hệ thống!");
      }
    } catch (error) {
      alert("Không thể kết nối đến Máy chủ (Backend)!");
    }
  };

  // 2. TÍCH HỢP API SỬA CẤU HÌNH TRẠM TRONG DATABASE
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;

    const updateConfig = {
      name: editingStation.name,
      zone: editingStation.zone,
      type: editingStation.type,
    };

    try {
      const response = await fetch(
        `https://do-an-r2gd.onrender.com/api/stations/config/${editingStation.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateConfig),
        },
      );

      if (response.ok) {
        onUpdateStation(editingStation);
        setIsEditModalOpen(false);
        alert("Cập nhật cấu hình trạm thành công!");
      }
    } catch (error) {
      alert("Không thể kết nối đến Máy chủ (Backend)!");
    }
  };

  // 3. TÍCH HỢP API XÓA TẬN GỐC TRONG DATABASE
  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa trạm "${name}" (${id}) khỏi hệ thống? Dữ liệu lịch sử cũng sẽ bị xóa vĩnh viễn.`,
      )
    ) {
      try {
        const response = await fetch(
          `https://do-an-r2gd.onrender.com/api/stations/config/${id}`,
          {
            method: "DELETE",
          },
        );

        if (response.ok) {
          onDeleteStation(id);
          alert("Đã xóa trạm khỏi Cơ sở dữ liệu!");
        }
      } catch (error) {
        alert("Không thể kết nối đến Máy chủ (Backend)!");
      }
    }
  };

  const openEditModal = (station: Station) => {
    setEditingStation(station);
    setIsEditModalOpen(true);
  };

  return (
    <div className="h-full w-full bg-gray-950 p-6 overflow-y-auto relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Quản lý trạm</h1>
            <p className="text-gray-400">
              Quản lý cấu hình thiết bị phần cứng trong mạng lưới.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            <span>Thêm trạm mới</span>
          </button>
        </div>

        {/* --- MODAL THÊM TRẠM MỚI --- */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                  <h3 className="text-white font-semibold">Đăng ký trạm mới</h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Mã trạm (ID)
                    </label>
                    <input
                      required
                      placeholder="VD: Node3"
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={formData.id}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Tên hiển thị
                    </label>
                    <input
                      required
                      placeholder="VD: Trạm giám sát số 3"
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Khu vực
                      </label>
                      <input
                        required
                        defaultValue="Hải Phòng"
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        onChange={(e) =>
                          setFormData({ ...formData, zone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Loại trạm
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      >
                        <option value="node">Sensor Node</option>
                        <option value="aggregator">Aggregator</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Vĩ độ (Lat)
                      </label>
                      <input
                        type="number"
                        step="0.0000001"
                        value={formData.lat}
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lat: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Kinh độ (Lng)
                      </label>
                      <input
                        type="number"
                        step="0.0000001"
                        value={formData.lng}
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lng: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 py-3 text-white font-bold rounded-lg hover:bg-cyan-500 transition-colors mt-4"
                  >
                    Lưu trạm vào hệ thống
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODAL SỬA TRẠM --- */}
        <AnimatePresence>
          {isEditModalOpen && editingStation && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                  <h3 className="text-white font-semibold">
                    Chỉnh sửa thông tin trạm
                  </h3>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Mã trạm (ID - Không thể sửa)
                    </label>
                    <input
                      disabled
                      className="w-full bg-gray-950 border border-gray-700 text-gray-500 p-2.5 rounded-lg mt-1 cursor-not-allowed"
                      value={editingStation.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Tên hiển thị
                    </label>
                    <input
                      required
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={editingStation.name}
                      onChange={(e) =>
                        setEditingStation({
                          ...editingStation,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Khu vực (Zone)
                      </label>
                      <input
                        required
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={editingStation.zone}
                        onChange={(e) =>
                          setEditingStation({
                            ...editingStation,
                            zone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Loại trạm
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={editingStation.type}
                        onChange={(e) =>
                          setEditingStation({
                            ...editingStation,
                            type: e.target.value as "node" | "aggregator",
                          })
                        }
                      >
                        <option value="node">Sensor Node</option>
                        <option value="aggregator">Aggregator</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 py-3 text-white font-bold rounded-lg hover:bg-cyan-500 transition-colors mt-4"
                  >
                    Lưu thay đổi
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Filters and Search */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo ID, tên hoặc khu vực..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-colors">
              <Filter size={20} />
              <span>Lọc</span>
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Hiển thị{" "}
            <span className="text-white font-medium">
              {filteredStations.length}
            </span>{" "}
            trạm
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/50 text-gray-400 text-xs uppercase font-medium border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">ID / Tên trạm</th>
                  <th className="px-6 py-4">Khu vực</th>
                  <th className="px-6 py-4">Loại</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Thông số hiện tại</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredStations.map((station, idx) => {
                  const isAlert =
                    station.temperature > 35 ||
                    station.pm25 > 100 ||
                    station.pirMotion;
                  return (
                    <motion.tr
                      key={station.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-gray-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-white">
                          {station.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {station.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded-md text-xs font-medium">
                          {station.zone}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-2 h-2 rounded-full ${station.type === "aggregator" ? "bg-purple-500" : "bg-blue-500"}`}
                          ></div>
                          <span className="capitalize">{station.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isAlert ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 rounded-md text-xs font-medium border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>{" "}
                            Cảnh báo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 rounded-md text-xs font-medium border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{" "}
                            Bình thường
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-3 text-xs">
                          <span
                            title="Nhiệt độ"
                            className={
                              station.temperature > 35
                                ? "text-red-400"
                                : "text-gray-400"
                            }
                          >
                            {station.temperature === 0
                              ? "--"
                              : station.temperature}
                            °C
                          </span>
                          <span title="Độ ẩm" className="text-gray-400">
                            {station.humidity === 0 ? "--" : station.humidity}%
                          </span>
                          <span
                            title="PM2.5"
                            className={
                              station.pm25 > 100
                                ? "text-red-400"
                                : station.pm25 > 50
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }
                          >
                            {station.pm25 === 0 ? "--" : station.pm25} µg/m³
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onViewOnMap(station)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
                            title="Xem trên bản đồ"
                          >
                            <MapPin size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(station)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(station.id, station.name)
                            }
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
